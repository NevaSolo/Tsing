import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from . import ai
from .tests import make_user

BRIEF = {"theme": "animals", "style": "vintage", "shirt_color": "#111111", "main_color": "#ffffff",
         "second_color": "#d62828", "slogans": ["Cri de la meute"], "summary": "Un loup.", "illustration": ["wolf"], "effects": []}


class FakeOllama(BaseHTTPRequestHandler):
    """Faux Ollama : le comportement dépend du modèle demandé."""

    calls = []

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FakeOllama.calls.append(payload)
        model = payload["model"]
        if model == "absent":
            return self._send(404, {"error": f"model '{model}' not found"})
        if model == "ancien" and "think" in payload:
            return self._send(400, {"error": "invalid think value"})
        if model == "bavard":
            return self._send(200, {"message": {"content": "Voici mon idée : un loup !"}})
        content = json.dumps(BRIEF)
        if model == "reflechit":
            content = "<think>hmm</think>" + content
        return self._send(200, {"message": {"role": "assistant", "content": content}, "eval_count": 123})

    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


class ServerAITests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.server = HTTPServer(("127.0.0.1", 0), FakeOllama)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        super().tearDownClass()

    def setUp(self):
        FakeOllama.calls = []
        cache.clear()  # limite de 6 demandes / minute : compteur remis à zéro entre les tests
        self.user = make_user("ia@example.com", "client")
        self.client.force_authenticate(self.user)

    def brief(self, **data):
        return self.client.post("/api/ai/brief/", {"prompt": "Un loup qui hurle à la lune", **data}, format="json")

    def test_disabled_without_url(self):
        self.assertEqual(self.client.get("/api/ai/config/").data, {"enabled": False, "model": None})
        self.assertEqual(self.brief().status_code, 503)

    def test_brief_uses_shared_spec_and_schema(self):
        with override_settings(OLLAMA_URL=self.url, OLLAMA_MODEL="qwen3:4b", OLLAMA_FALLBACK_MODELS=[]):
            self.assertEqual(self.client.get("/api/ai/config/").data, {"enabled": True, "model": "qwen3:4b"})
            res = self.brief(text="Meute")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["brief"]["illustration"], ["wolf"])
        self.assertEqual(res.data["model"], "qwen3:4b")
        call = FakeOllama.calls[0]
        spec = ai.spec()
        self.assertEqual(call["messages"][0]["content"], spec["system"], "même consigne que le site")
        self.assertEqual(call["format"], spec["schema"], "sortie contrainte au schéma du site")
        self.assertIn("Texte imposé : Meute", call["messages"][1]["content"])
        self.assertFalse(call["think"])
        self.assertFalse(call["stream"])

    def test_fallbacks(self):
        # Modèle absent → secours ; Ollama ancien (« think » refusé) → nouvel essai sans ; balises de réflexion retirées.
        with override_settings(OLLAMA_URL=self.url, OLLAMA_MODEL="absent", OLLAMA_FALLBACK_MODELS=["ancien"]):
            res = self.brief()
        self.assertEqual((res.status_code, res.data["model"]), (200, "ancien"))
        self.assertNotIn("think", FakeOllama.calls[-1])
        with override_settings(OLLAMA_URL=self.url, OLLAMA_MODEL="reflechit", OLLAMA_FALLBACK_MODELS=[]):
            self.assertEqual(self.brief().data["brief"]["theme"], "animals")
        with override_settings(OLLAMA_URL=self.url, OLLAMA_MODEL="bavard", OLLAMA_FALLBACK_MODELS=[]):
            self.assertEqual(self.brief().status_code, 502)

    def test_ollama_down_and_validation(self):
        with override_settings(OLLAMA_URL="http://127.0.0.1:9", OLLAMA_TIMEOUT=2):
            self.assertEqual(self.brief().status_code, 503)
        with override_settings(OLLAMA_URL=self.url):
            self.assertEqual(self.brief(prompt="x" * 601).status_code, 400)
            self.client.force_authenticate(None)
            self.assertEqual(self.brief().status_code, 401)

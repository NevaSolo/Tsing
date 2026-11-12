"""
IA du serveur : génération du « brief » de design par Ollama (modèle local, aucune API payante).

La consigne et le schéma JSON viennent de ai_spec.json, exporté depuis le site (client/src/ai/brief.js,
`npm run ai:spec`) : le serveur pose exactement la même question que l'IA du navigateur, et le
navigateur ne peut envoyer que la demande de l'utilisateur (pas de détournement du modèle).

Ollama n'est jamais exposé sur Internet : Django l'appelle sur le réseau interne (OLLAMA_URL).
"""
import json
import logging
import time
import urllib.error
import urllib.request
from functools import lru_cache
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)
SPEC_FILE = Path(__file__).with_name("ai_spec.json")


class AIError(Exception):
    """Erreur présentée à l'utilisateur (le site bascule alors sur le générateur par mots-clés)."""

    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


@lru_cache(maxsize=1)
def spec():
    return json.loads(SPEC_FILE.read_text(encoding="utf-8"))


def enabled():
    return bool(settings.OLLAMA_URL)


def models():
    return [m for m in [settings.OLLAMA_MODEL, *settings.OLLAMA_FALLBACK_MODELS] if m]


def _post(path, payload, timeout):
    request = urllib.request.Request(
        settings.OLLAMA_URL.rstrip("/") + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def generate_brief(prompt, text=""):
    """Demande un brief au modèle ; renvoie (brief: dict, infos: dict). Lève AIError en cas d'échec."""
    s = spec()
    user = f"{prompt}\n{s['text_label']}{text}" if text else prompt
    messages = [
        {"role": "system", "content": s["system"]},
        # « /no_think » : Qwen3 répond directement, sans phase de réflexion (bien plus rapide sur processeur).
        {"role": "user", "content": f"{user} /no_think"},
    ]
    last_error = None
    for model in models():
        payload = {
            "model": model,
            "messages": messages,
            "format": s["schema"],  # sortie contrainte au schéma JSON (Ollama ≥ 0.5)
            "stream": False,
            "think": False,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
            "options": {"temperature": 0.7, "num_predict": 400},
        }
        started = time.monotonic()
        try:
            try:
                data = _post("/api/chat", payload, settings.OLLAMA_TIMEOUT)
            except urllib.error.HTTPError as err:
                # Ollama ancien ou modèle sans mode « réflexion » : on réessaie sans ce paramètre.
                if err.code == 400 and "think" in err.read().decode("utf-8", "replace").lower():
                    payload.pop("think")
                    data = _post("/api/chat", payload, settings.OLLAMA_TIMEOUT)
                else:
                    raise
        except urllib.error.HTTPError as err:
            last_error = err
            logger.warning("Ollama %s : HTTP %s", model, err.code)
            continue  # modèle absent (404)… on essaie le suivant
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            logger.warning("Ollama injoignable ou trop lent : %s", err)
            raise AIError("L'IA du serveur ne répond pas pour le moment.", status=503) from err

        content = (data.get("message") or {}).get("content", "")
        # Certains modèles entourent malgré tout le JSON de balises de réflexion.
        if "</think>" in content:
            content = content.split("</think>", 1)[1]
        try:
            brief = json.loads(content.strip())
        except json.JSONDecodeError:
            last_error = ValueError("réponse non JSON")
            logger.warning("Ollama %s : réponse illisible", model)
            continue
        if not isinstance(brief, dict):
            last_error = ValueError("réponse inattendue")
            continue
        return brief, {
            "model": model,
            "seconds": round(time.monotonic() - started, 1),
            "tokens": data.get("eval_count"),
        }
    logger.error("Aucun modèle Ollama n'a répondu : %s", last_error)
    raise AIError("L'IA du serveur n'a pas pu répondre.")

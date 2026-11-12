from decimal import Decimal

from rest_framework.test import APITestCase

from .models import Message, Shirt
from .tests import make_user


class MessagingTests(APITestCase):
    def setUp(self):
        self.client_user = make_user("client@example.com", "client")
        self.designer = make_user("designer@example.com", "designer")
        self.designer.first_name = "Lova"
        self.designer.save()
        self.other = make_user("autre@example.com", "client")
        self.shirt = Shirt.objects.create(designer=self.designer, name="Les Vagues", price=Decimal("20"), stock=3)

    def start(self, **extra):
        self.client.force_authenticate(self.client_user)
        return self.client.post("/api/conversations/", {"designer": self.designer.id, **extra}, format="json")

    def test_full_exchange(self):
        res = self.start(body="Bonjour, ce modèle existe en rouge ?", shirt=self.shirt.id)
        self.assertEqual(res.status_code, 201, res.data)
        conv = res.data["id"]
        self.assertEqual(res.data["other"]["name"], "Lova")
        self.assertEqual(res.data["role"], "client")
        self.assertTrue(res.data["last_message"]["has_shirt"])

        # Le designer voit la conversation, avec 1 non lu.
        self.client.force_authenticate(self.designer)
        listing = self.client.get("/api/conversations/").data
        self.assertEqual([(c["id"], c["unread"], c["role"]) for c in listing], [(conv, 1, "designer")])
        self.assertEqual(self.client.get("/api/conversations/unread/").data["count"], 1)
        msgs = self.client.get(f"/api/conversations/{conv}/messages/").data
        self.assertEqual(msgs[0]["shirt"]["name"], "Les Vagues")
        self.assertFalse(msgs[0]["mine"])
        self.assertEqual(self.client.post(f"/api/conversations/{conv}/read/").data["read"], 1)
        self.assertEqual(self.client.get("/api/conversations/unread/").data["count"], 0)
        reply = self.client.post(f"/api/conversations/{conv}/messages/", {"body": "Oui, je vous le prépare !"}, format="json")
        self.assertEqual(reply.status_code, 201)
        self.assertTrue(reply.data["mine"])

        # Le client ne récupère que les nouveaux messages (rafraîchissement automatique).
        self.client.force_authenticate(self.client_user)
        new = self.client.get(f"/api/conversations/{conv}/messages/?after={msgs[0]['id']}").data
        self.assertEqual([m["body"] for m in new], ["Oui, je vous le prépare !"])
        self.assertEqual(self.client.get("/api/conversations/unread/").data["count"], 1)
        # Son premier message a bien été lu par le designer.
        first = self.client.get(f"/api/conversations/{conv}/messages/").data[0]
        self.assertIsNotNone(first["read_at"])

    def test_same_pair_reuses_conversation(self):
        first = self.start(body="Premier")
        again = self.start(body="Second")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.data["id"], again.data["id"])
        self.assertEqual(Message.objects.filter(conversation_id=first.data["id"]).count(), 2)
        # Ouvrir sans message est permis (page « Contacter »).
        self.assertEqual(self.start().status_code, 200)

    def test_privacy_third_party_sees_nothing(self):
        conv = self.start(body="Privé").data["id"]
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/conversations/").data, [])
        self.assertEqual(self.client.get(f"/api/conversations/{conv}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/conversations/{conv}/messages/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/conversations/{conv}/messages/", {"body": "intrus"}, format="json").status_code, 404)
        self.assertEqual(self.client.post(f"/api/conversations/{conv}/read/").status_code, 404)
        self.assertEqual(self.client.get("/api/conversations/unread/").data["count"], 0)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/conversations/").status_code, 401)

    def test_validation(self):
        self.client.force_authenticate(self.client_user)
        # Destinataire : un designer, pas soi-même.
        self.assertEqual(self.client.post("/api/conversations/", {"designer": self.other.id, "body": "x"}, format="json").status_code, 400)
        self.client.force_authenticate(self.designer)
        self.assertEqual(self.client.post("/api/conversations/", {"designer": self.designer.id, "body": "x"}, format="json").status_code, 400)
        conv = self.start(body="ok").data["id"]
        for bad in ({}, {"body": "   "}, {"body": "x" * 2001}, {"shirt": 99999}):
            res = self.client.post(f"/api/conversations/{conv}/messages/", bad, format="json")
            self.assertEqual(res.status_code, 400, bad)
        self.assertEqual(self.client.get(f"/api/conversations/{conv}/messages/?after=abc").status_code, 400)

    def test_contact_lookup(self):
        self.client.force_authenticate(self.client_user)
        info = self.client.get(f"/api/conversations/contact/?designer={self.designer.id}").data
        self.assertEqual(info["designer"]["name"], "Lova")
        self.assertIsNone(info["conversation"])
        conv = self.start(body="Salut").data["id"]
        self.assertEqual(self.client.get(f"/api/conversations/contact/?designer={self.designer.id}").data["conversation"], conv)
        self.assertEqual(self.client.get(f"/api/conversations/contact/?designer={self.other.id}").status_code, 404)

    def test_shirt_deleted_keeps_message(self):
        conv = self.start(body="Ce modèle ?", shirt=self.shirt.id).data["id"]
        self.shirt.delete()
        msgs = self.client.get(f"/api/conversations/{conv}/messages/").data
        self.assertEqual(msgs[0]["body"], "Ce modèle ?")
        self.assertIsNone(msgs[0]["shirt"])

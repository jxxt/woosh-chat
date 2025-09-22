# backend/_firebase.py
import os
import firebase_admin
from firebase_admin import credentials, db
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

SERVICE_ACCOUNT_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "./firebase_service_account.json")
DB_URL = os.environ.get("FIREBASE_DB_URL")

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"databaseURL": DB_URL})

def get_db_ref(path="/"):
    init_firebase()
    return db.reference(path)

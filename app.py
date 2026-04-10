from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import sys
import traceback

from extensions import db, migrate

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, "static"),
    static_url_path="/static",
)

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, 'dataling.db')}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-key-mude-isso")

db.init_app(app)
migrate.init_app(app, db)
CORS(app)

print("DEBUG: Importing models...")
try:
    from models import (
        Student,
        SkillNode,
        EvidenceEvent,
        StudentSkillState,
        TestItem,
        TestSession,
        AdvisedVocabItem,
        ChecklistItem,
    )
    print("DEBUG: Models imported successfully")
except Exception as e:
    print(f"DEBUG: Error importing models: {e}")
    traceback.print_exc()

print("DEBUG: Importing students_bp...")
try:
    from routes.students import students_bp
    app.register_blueprint(students_bp, url_prefix="/api")
    print("DEBUG: students_bp registered")
except Exception as e:
    print(f"DEBUG: Error with students_bp: {e}")
    traceback.print_exc()

print("DEBUG: Importing skills_bp...")
try:
    from routes.skills import skills_bp
    app.register_blueprint(skills_bp, url_prefix="/api")
    print("DEBUG: skills_bp registered")
except Exception as e:
    print(f"DEBUG: Error with skills_bp: {e}")
    traceback.print_exc()

print("DEBUG: Importing reporting_bp...")
try:
    from routes.reporting import reporting_bp
    print(f"DEBUG: reporting_bp imported, name={reporting_bp.name}")
    app.register_blueprint(reporting_bp, url_prefix="/api")
    print("DEBUG: reporting_bp registered")
except Exception as e:
    print(f"DEBUG: Error with reporting_bp: {e}")
    traceback.print_exc()

print("DEBUG: Importing advising_bp...", flush=True)
sys.stdout.flush()
try:
    from routes.advising import advising_bp
    print(f"DEBUG: advising_bp imported, name={advising_bp.name}", flush=True)
    app.register_blueprint(advising_bp, url_prefix="/api")
    print("DEBUG: advising_bp registered", flush=True)
except Exception as e:
    print(f"DEBUG: Error with advising_bp: {e}", flush=True)
    traceback.print_exc()

print("DEBUG: Importing testing_bp...", flush=True)
try:

    from routes.testing import testing_bp
    print(f"DEBUG: testing_bp imported, name={testing_bp.name}", flush=True)
    app.register_blueprint(testing_bp, url_prefix="/api")
    print("DEBUG: testing_bp registered", flush=True)
except Exception as e:
    print(f"DEBUG: Error with testing_bp:  {e}", flush=True)
    traceback.print_exc()

print("DEBUG: Final route list:")
for rule in app.url_map.iter_rules():
    print(f"  {rule}")

@app.route("/", methods=["GET"])
def index():
    return send_from_directory(
        os.path.join(BASE_DIR, "static", "html"),
        "index.html",
    )

from routes.analytics import analytics_bp
app.register_blueprint(analytics_bp, url_prefix="/api")

if __name__ == "__main__":
    app.run(port=5000, debug=True)
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os

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

from models import (
    Student,
    SkillNode,
    EvidenceEvent,
    StudentSkillState,
    TestItem,
    TestSession,
    AdvisedVocabItem,
)

from routes.students import students_bp
app.register_blueprint(students_bp, url_prefix="/api")

from routes.skills import skills_bp
app.register_blueprint(skills_bp, url_prefix="/api")


@app.route("/", methods=["GET"])
def index():
    return send_from_directory(
        os.path.join(BASE_DIR, "static", "html"),
        "index.html",
    )


if __name__ == "__main__":
    app.run(port=5000, debug=True)
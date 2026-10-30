"""Issue #37: el servicio de IA. Ninguna prueba sale a internet."""
import os

os.environ.setdefault("JWT_SECRET", "secreto-de-prueba-solo-para-pytest-local")

import json

import httpx
import pytest

from app import config, ia

CLAVE = "clave-secreta-de-prueba"
QUIZ = ia.QuizGenerado.ejemplo_falso()


def respuesta(texto, status=200):
    return httpx.Response(
        status,
        json={"steps": [{"type": "thought"}, {"type": "model_output", "content": [{"type": "text", "text": texto}]}]},
        request=httpx.Request("POST", ia.URL_GEMINI),
    )


@pytest.fixture
def gemini(monkeypatch):
    """Reemplaza la llamada HTTP. Devuelve las llamadas recibidas; `gemini.responder` fija qué contesta."""
    monkeypatch.setattr(config, "IA_PROVEEDOR", "gemini")
    monkeypatch.setattr(config, "IA_API_KEY", CLAVE)
    monkeypatch.setattr(config, "IA_MODELO", "modelo-de-prueba")

    class Falso:
        llamadas = []
        responder = staticmethod(lambda: respuesta("hola"))

    Falso.llamadas = []

    def post(url, **kwargs):
        Falso.llamadas.append({"url": url, **kwargs})
        return Falso.responder()

    monkeypatch.setattr(ia.httpx, "post", post)
    return Falso


def test_texto_correcto_y_lo_que_se_envia(gemini):
    assert ia.generar_texto("mis datos", "eres un gato") == "hola"
    llamada = gemini.llamadas[0]
    assert llamada["json"]["input"] == "mis datos"
    assert llamada["json"]["system_instruction"] == "eres un gato"
    assert llamada["json"]["model"] == "modelo-de-prueba"
    assert llamada["json"]["store"] is False
    assert llamada["timeout"] == ia.TIEMPO_MAXIMO_SEG


def test_la_clave_va_en_el_encabezado_y_no_en_la_url(gemini):
    ia.generar_texto("a", "b")
    llamada = gemini.llamadas[0]
    assert llamada["headers"]["x-goog-api-key"] == CLAVE
    assert CLAVE not in llamada["url"]
    assert CLAVE not in json.dumps(llamada["json"])


def test_json_correcto_se_valida_contra_el_esquema(gemini):
    gemini.responder = staticmethod(lambda: respuesta(json.dumps(QUIZ)))
    quiz = ia.generar_json("apuntes", "sistema", ia.QuizGenerado)
    assert len(quiz.preguntas) == 5
    formato = gemini.llamadas[0]["json"]["response_format"]
    assert formato["mime_type"] == "application/json"
    assert formato["schema"] == ia.QuizGenerado.ESQUEMA_JSON


@pytest.mark.parametrize(
    "texto",
    [
        "esto no es JSON",
        json.dumps({"preguntas": QUIZ["preguntas"][:4]}),  # faltan preguntas
        json.dumps({"preguntas": [{**QUIZ["preguntas"][0], "correcta": 4}] * 5}),  # índice fuera de rango
        json.dumps({"preguntas": [{**QUIZ["preguntas"][0], "opciones": ["a", "b"]}] * 5}),  # faltan opciones
    ],
)
def test_json_invalido_no_llega_al_resto_del_backend(gemini, texto):
    gemini.responder = staticmethod(lambda: respuesta(texto))
    with pytest.raises(ia.IAnoDisponible):
        ia.generar_json("apuntes", "sistema", ia.QuizGenerado)


def test_el_error_de_json_invalido_no_arrastra_la_respuesta(gemini):
    gemini.responder = staticmethod(lambda: respuesta("apuntes privados del estudiante"))
    with pytest.raises(ia.IAnoDisponible) as e:
        ia.generar_json("apuntes", "sistema", ia.QuizGenerado)
    assert "apuntes privados" not in str(e.value)
    assert e.value.__cause__ is None


def test_tiempo_agotado(gemini):
    def agotado():
        raise httpx.ReadTimeout("tardó mucho")

    gemini.responder = staticmethod(agotado)
    with pytest.raises(ia.IAnoDisponible):
        ia.generar_texto("a", "b")


def test_cupo_agotado(gemini):
    gemini.responder = staticmethod(lambda: respuesta("x", status=429))
    with pytest.raises(ia.IAnoDisponible, match="429"):
        ia.generar_texto("a", "b")


@pytest.mark.parametrize(
    "cuerpo",
    [{}, {"steps": []}, {"steps": [{"type": "thought"}]}, {"steps": [{"type": "model_output", "content": []}]}],
)
def test_respuesta_sin_texto(gemini, cuerpo):
    gemini.responder = staticmethod(
        lambda: httpx.Response(200, json=cuerpo, request=httpx.Request("POST", ia.URL_GEMINI))
    )
    with pytest.raises(ia.IAnoDisponible):
        ia.generar_texto("a", "b")


def test_sin_clave_no_se_llama_al_proveedor(gemini, monkeypatch):
    monkeypatch.setattr(config, "IA_API_KEY", "")
    with pytest.raises(ia.IAnoDisponible):
        ia.generar_texto("a", "b")
    assert gemini.llamadas == []


def test_modo_falso_no_sale_a_internet(monkeypatch):
    monkeypatch.setattr(config, "IA_PROVEEDOR", "falso")
    monkeypatch.setattr(config, "IA_API_KEY", "")

    def prohibido(*args, **kwargs):
        raise AssertionError("El modo falso no debe llamar a la red")

    monkeypatch.setattr(ia.httpx, "post", prohibido)
    assert ia.generar_texto("a", "b") == ia.TEXTO_FALSO
    quiz = ia.generar_json("a", "b", ia.QuizGenerado)
    assert [p.correcta for p in quiz.preguntas] == [0, 0, 0, 0, 0]

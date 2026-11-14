import os, pytest
pytestmark=pytest.mark.skipif(not os.getenv("RUN_DB_TESTS"),reason="requires migrated PostgreSQL")
def test_health_and_lookup():
    from fastapi.testclient import TestClient
    from app.main import app
    client=TestClient(app); assert client.get("/api/health").status_code==200; assert client.get("/api/lookup",params={"q":"198.51.0.1"}).status_code in (200,404)
def test_graph_limit():
    from fastapi.testclient import TestClient
    from app.main import app
    response=TestClient(app).get("/api/graph/1",params={"max_nodes":250}); assert response.status_code==200; assert len(response.json()["nodes"])<=250


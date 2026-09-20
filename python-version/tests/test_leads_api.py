from __future__ import annotations


class TestLeadsList:
    def test_get_leads_ok(self, client):
        r = client.get("/leads")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_filter_status_closed_won(self, client):
        r = client.get("/leads?status=closed_won&limit=5000")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for row in data:
            assert row["lead_status"] == "closed_won"

    def test_free_text_search_singh(self, client):
        r = client.get("/leads?q=singh&limit=5000")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for row in data:
            haystack = " ".join(
                [
                    str(row.get("first_name") or ""),
                    str(row.get("last_name") or ""),
                    str(row.get("full_name") or ""),
                    str(row.get("company_name") or ""),
                    str(row.get("email") or ""),
                ]
            ).lower()
            assert "singh" in haystack


class TestLeadDetail:
    def test_get_lead_1(self, client):
        r = client.get("/leads/1")
        assert r.status_code == 200
        data = r.json()
        assert data.get("id") == 1

    def test_get_lead_404(self, client):
        r = client.get("/leads/999999")
        assert r.status_code == 404


class TestLeadPatch:
    def test_patch_notes(self, client):
        r = client.patch("/leads/1", json={"notes": "test patch notes"})
        assert r.status_code == 200
        data = r.json()
        assert data["notes"] == "test patch notes"

        r2 = client.get("/leads/1")
        assert r2.status_code == 200
        assert r2.json()["notes"] == "test patch notes"


class TestLeadExport:
    def test_export_content_type(self, client):
        r = client.get("/leads/export?status=new")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        body = r.text
        lines = body.splitlines()
        assert len(lines) >= 2
        assert "id" in lines[0].split(",") or "record_id" in lines[0].split(",")

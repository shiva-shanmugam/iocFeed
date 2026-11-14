from ingest.normalizer import normalize_record
def test_normalizer_extracts_family_and_refangs():
    item=normalize_record("hxxp://bad[.]example/x",{"malware":"Emotet","tags":["c2"]}); assert item.value=="http://bad.example/x"; assert item.families==["Emotet"]


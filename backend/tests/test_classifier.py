import pytest
from app.models import IndicatorType
from app.services.classifier import classify, defang, refang
def test_refang(): assert refang("hxxps://evil[.]example/a") == "https://evil.example/a"
def test_defang(): assert defang("http://evil.example") == "hxxp://evil[.]example"
@pytest.mark.parametrize(("value","typ"),[("198.51.100.3",IndicatorType.ipv4),("test.example",IndicatorType.domain),("a"*64,IndicatorType.sha256),("hxxp://x[.]example/a",IndicatorType.url)])
def test_classify(value,typ): assert classify(value)[0] == typ
def test_rejects_bad_input():
    with pytest.raises(ValueError): classify("not an ioc")


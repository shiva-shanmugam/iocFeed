import ipaddress
import re
from urllib.parse import urlparse
import tldextract
from app.models import IndicatorType
HASHES = {32: IndicatorType.md5, 40: IndicatorType.sha1, 64: IndicatorType.sha256}
def refang(value: str) -> str:
    value = value.strip().replace("[.]", ".").replace("(.)", ".")
    value = re.sub(r"^hxxps://", "https://", value, flags=re.I)
    return re.sub(r"^hxxp://", "http://", value, flags=re.I)
def defang(value: str) -> str:
    return value.replace("https://", "hxxps://").replace("http://", "hxxp://").replace(".", "[.]")
def classify(value: str) -> tuple[IndicatorType, str]:
    clean = refang(value)
    try:
        ip = ipaddress.ip_address(clean)
        if ip.version == 4: return IndicatorType.ipv4, str(ip)
    except ValueError: pass
    if clean.lower().startswith(("http://", "https://")):
        if not urlparse(clean).hostname: raise ValueError("invalid URL")
        return IndicatorType.url, clean
    if re.fullmatch(r"[0-9a-fA-F]+", clean) and len(clean) in HASHES: return HASHES[len(clean)], clean.lower()
    ext = tldextract.extract(clean)
    if ext.domain and ext.suffix and re.fullmatch(r"(?=.{1,253}$)[A-Za-z0-9.-]+", clean): return IndicatorType.domain, clean.lower().rstrip(".")
    raise ValueError("unsupported or invalid indicator")


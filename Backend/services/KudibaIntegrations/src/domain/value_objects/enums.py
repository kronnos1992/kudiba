from enum import Enum


class ConnectorType(str, Enum):
    WEBHOOK = "WEBHOOK"
    REST_PULL = "REST_PULL"
    FILE_IMPORT = "FILE_IMPORT"


class DataFormat(str, Enum):
    JSON = "JSON"
    CSV = "CSV"
    FIXED_WIDTH = "FIXED_WIDTH"


class AuthType(str, Enum):
    NONE = "NONE"
    API_KEY = "API_KEY"
    BASIC = "BASIC"
    BEARER = "BEARER"


class ConflictPolicy(str, Enum):
    SKIP = "SKIP"
    UPDATE = "UPDATE"
    FAIL = "FAIL"


class RunStatus(str, Enum):
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class RunTrigger(str, Enum):
    WEBHOOK = "WEBHOOK"
    SCHEDULE = "SCHEDULE"
    MANUAL = "MANUAL"

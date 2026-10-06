import enum


class CaseStatus(enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class CasePriority(enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CaseCategory(enum.Enum):
    BILLING = "BILLING"
    PAYMENT = "PAYMENT"
    METER_READING = "METER_READING"
    POWER_OUTAGE = "POWER_OUTAGE"
    CONNECTION = "CONNECTION"
    SERVICE_REQUEST = "SERVICE_REQUEST"
    COMPLAINT = "COMPLAINT"
    ACCOUNT_UPDATE = "ACCOUNT_UPDATE"
    OTHER = "OTHER"


class SenderType(enum.Enum):
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"


class ConversationChannel(enum.Enum):
    CHAT = "CHAT"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    IMPORTED = "IMPORTED"


class Sentiment(enum.Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    CONCERNED = "CONCERNED"
    FRUSTRATED = "FRUSTRATED"
    ANGRY = "ANGRY"


class AIAnalysisRunStatus(enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class EmailStatus(enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
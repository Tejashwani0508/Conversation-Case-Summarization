"""
Seed script to populate the Conversation & Case Summarization application
with realistic demo data.

This script is idempotent: running it multiple times will not create
duplicate records. It preserves all existing data.

Usage:
    cd backend
    python seed_demo_data.py
"""

from datetime import datetime, timedelta

from sqlalchemy import func, select

from app.database.connection import SessionLocal
from app.database.base import utc_now
from app.models.case import CustomerCase
from app.models.conversation import Conversation
from app.models.customer import Customer
from app.models.enums import (
    CaseCategory,
    CasePriority,
    CaseStatus,
    ConversationChannel,
    SenderType,
)

# ─── Demo Customers ──────────────────────────────────────────────────────────

DEMO_CUSTOMERS = [
    {
        "customer_code": "CUS-000004",
        "name": "Rahul Mehta",
        "email": "rahul.mehta@example.com",
        "phone": "+91-98765-43210",
        "account_number": "ACC10004",
        "address": "42 Lakeview Road, Bengaluru, Karnataka 560001",
    },
    {
        "customer_code": "CUS-000005",
        "name": "Sneha Iyer",
        "email": "sneha.iyer@example.com",
        "phone": "+91-91234-56780",
        "account_number": "ACC10005",
        "address": "17 Rosewood Lane, Chennai, Tamil Nadu 600017",
    },
    {
        "customer_code": "CUS-000006",
        "name": "Vikram Rao",
        "email": "vikram.rao@example.com",
        "phone": "+91-99887-76655",
        "account_number": "ACC10006",
        "address": "8 Palm Grove Street, Hyderabad, Telangana 500081",
    },
    {
        "customer_code": "CUS-000007",
        "name": "Ananya Nair",
        "email": "ananya.nair@example.com",
        "phone": "+91-90909-80807",
        "account_number": "ACC10007",
        "address": "23 Maple Avenue, Kochi, Kerala 682001",
    },
    {
        "customer_code": "CUS-000008",
        "name": "Karthik Varma",
        "email": "karthik.varma@example.com",
        "phone": "+91-98765-12345",
        "account_number": "ACC10008",
        "address": "56 Cedar Court, Pune, Maharashtra 411001",
    },
    {
        "customer_code": "CUS-000009",
        "name": "Neha Kapoor",
        "email": "neha.kapoor@example.com",
        "phone": "+91-87654-32109",
        "account_number": "ACC10009",
        "address": "9 Willow Park, New Delhi, Delhi 110001",
    },
    {
        "customer_code": "CUS-000010",
        "name": "Rohit Menon",
        "email": "rohit.menon@example.com",
        "phone": "+91-76543-21098",
        "account_number": "ACC10010",
        "address": "31 Birch Street, Mumbai, Maharashtra 400001",
    },
    {
        "customer_code": "CUS-000011",
        "name": "Divya Patel",
        "email": "divya.patel@example.com",
        "phone": "+91-65432-10987",
        "account_number": "ACC10011",
        "address": "14 Jasmine Road, Ahmedabad, Gujarat 380001",
    },
]

# ─── Demo Cases ──────────────────────────────────────────────────────────────

# Each case references a customer by customer_code.
# created_days_ago controls the case creation date.
# conversations are (sender_type, sender_name, message, channel, hours_after_case_created)

DEMO_CASES = [
    {
        "case_number": "CASE-000002",
        "customer_code": "CUS-000005",
        "subject": "Unable to access my customer account",
        "description": (
            "Customer is unable to log into the account after resetting their password. "
            "The reset email is received successfully, but the new password is rejected "
            "when attempting to sign in. Customer has tried multiple times and is concerned "
            "about account security."
        ),
        "category": CaseCategory.ACCOUNT_UPDATE,
        "priority": CasePriority.HIGH,
        "status": CaseStatus.OPEN,
        "assigned_agent": "Priya Nair",
        "created_days_ago": 0,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Sneha Iyer",
                "I reset my password yesterday but now I can't log in at all. The new password keeps getting rejected.",
                ConversationChannel.CHAT,
                0,
            ),
            (
                SenderType.AGENT,
                "Priya Nair",
                "I understand your concern. Let me check your account status and verify the password reset was processed correctly.",
                ConversationChannel.CHAT,
                0.2,
            ),
            (
                SenderType.CUSTOMER,
                "Sneha Iyer",
                "I received the reset email and clicked the link, but when I enter the new password it says invalid credentials.",
                ConversationChannel.CHAT,
                0.5,
            ),
            (
                SenderType.AGENT,
                "Priya Nair",
                "Thank you for confirming. I can see the password reset was initiated but there may be a sync issue. I'll escalate this to our technical team.",
                ConversationChannel.CHAT,
                0.8,
            ),
            (
                SenderType.CUSTOMER,
                "Sneha Iyer",
                "Please fix this as soon as possible. I need to access my account to pay my bill.",
                ConversationChannel.CHAT,
                1.0,
            ),
        ],
    },
    {
        "case_number": "CASE-000003",
        "customer_code": "CUS-000006",
        "subject": "Payment was deducted but order is still showing unpaid",
        "description": (
            "Customer made an online payment for their electricity bill through the mobile app. "
            "The amount was deducted from the bank account, but the payment status in the app "
            "still shows as unpaid. Customer is worried about late payment penalties."
        ),
        "category": CaseCategory.PAYMENT,
        "priority": CasePriority.HIGH,
        "status": CaseStatus.IN_PROGRESS,
        "assigned_agent": "Ravi Shankar",
        "created_days_ago": 1,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Vikram Rao",
                "I paid my electricity bill through the app this morning but it still shows as unpaid. The money was deducted from my bank.",
                ConversationChannel.CHAT,
                0,
            ),
            (
                SenderType.AGENT,
                "Ravi Shankar",
                "I'm sorry for the inconvenience. Let me look up your payment transaction to verify the status.",
                ConversationChannel.CHAT,
                0.3,
            ),
            (
                SenderType.CUSTOMER,
                "Vikram Rao",
                "I have the transaction reference number if you need it. The bank confirmed the payment went through.",
                ConversationChannel.CHAT,
                0.6,
            ),
            (
                SenderType.AGENT,
                "Ravi Shankar",
                "I can see the payment was received by our payment gateway. There seems to be a delay in updating the billing system. I'll manually reconcile this.",
                ConversationChannel.CHAT,
                1.0,
            ),
            (
                SenderType.CUSTOMER,
                "Vikram Rao",
                "Will I be charged a late fee for this? It's not my fault the system didn't update.",
                ConversationChannel.CHAT,
                1.5,
            ),
            (
                SenderType.AGENT,
                "Ravi Shankar",
                "No late fees will be applied. I've noted this on your account and the payment will be reflected within 24 hours.",
                ConversationChannel.CHAT,
                2.0,
            ),
        ],
    },
    {
        "case_number": "CASE-000004",
        "customer_code": "CUS-000007",
        "subject": "Internet connection keeps disconnecting",
        "description": (
            "Customer reports that their internet connection drops frequently throughout the day. "
            "The issue started about a week ago. Customer has already restarted the router multiple "
            "times and checked all cable connections, but the problem persists."
        ),
        "category": CaseCategory.CONNECTION,
        "priority": CasePriority.HIGH,
        "status": CaseStatus.OPEN,
        "assigned_agent": "Arun Kumar",
        "created_days_ago": 2,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Ananya Nair",
                "My internet keeps disconnecting every few minutes. It's been happening for a week now and it's really frustrating.",
                ConversationChannel.PHONE,
                0,
            ),
            (
                SenderType.AGENT,
                "Arun Kumar",
                "I'm sorry to hear that. Have you tried restarting your router?",
                ConversationChannel.PHONE,
                0.1,
            ),
            (
                SenderType.CUSTOMER,
                "Ananya Nair",
                "Yes, I've restarted it multiple times and checked all the cables. The lights on the router still show a connection but the internet drops.",
                ConversationChannel.PHONE,
                0.3,
            ),
            (
                SenderType.AGENT,
                "Arun Kumar",
                "I can see from our system that there have been multiple disconnection events on your line. This may indicate a signal issue in your area.",
                ConversationChannel.PHONE,
                0.5,
            ),
            (
                SenderType.CUSTOMER,
                "Ananya Nair",
                "Can you send a technician to check? I work from home and this is affecting my job.",
                ConversationChannel.PHONE,
                0.7,
            ),
            (
                SenderType.AGENT,
                "Arun Kumar",
                "I've scheduled a technician visit for tomorrow between 10 AM and 1 PM. We'll also monitor your connection in the meantime.",
                ConversationChannel.PHONE,
                0.9,
            ),
        ],
    },
    {
        "case_number": "CASE-000005",
        "customer_code": "CUS-000008",
        "subject": "Refund has not been credited to my account",
        "description": (
            "Customer requested a refund for an overcharged service fee two weeks ago. "
            "The refund was approved by the support team, but the amount has not been "
            "credited to the customer's bank account yet."
        ),
        "category": CaseCategory.BILLING,
        "priority": CasePriority.MEDIUM,
        "status": CaseStatus.IN_PROGRESS,
        "assigned_agent": "Meera Joshi",
        "created_days_ago": 3,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Karthik Varma",
                "I was told my refund would be processed within 5-7 business days but it's been two weeks and I still haven't received it.",
                ConversationChannel.EMAIL,
                0,
            ),
            (
                SenderType.AGENT,
                "Meera Joshi",
                "I apologize for the delay. Let me check the status of your refund request.",
                ConversationChannel.EMAIL,
                0.5,
            ),
            (
                SenderType.CUSTOMER,
                "Karthik Varma",
                "The refund was for an overcharge on my last bill. I have the approval email from your team.",
                ConversationChannel.EMAIL,
                1.0,
            ),
            (
                SenderType.AGENT,
                "Meera Joshi",
                "I can see the refund was approved but it appears to be stuck in the payment processing queue. I'll escalate this to our finance team for immediate action.",
                ConversationChannel.EMAIL,
                1.5,
            ),
            (
                SenderType.CUSTOMER,
                "Karthik Varma",
                "Please make sure this gets resolved. I've been waiting too long for this.",
                ConversationChannel.EMAIL,
                2.0,
            ),
        ],
    },
    {
        "case_number": "CASE-000006",
        "customer_code": "CUS-000009",
        "subject": "Service technician has not arrived",
        "description": (
            "Customer scheduled a technician visit to fix a power connection issue. "
            "The technician was supposed to arrive between 9 AM and 12 PM, but it is now "
            "past 2 PM and no one has shown up. Customer has taken time off work for this visit."
        ),
        "category": CaseCategory.SERVICE_REQUEST,
        "priority": CasePriority.MEDIUM,
        "status": CaseStatus.OPEN,
        "assigned_agent": "Suresh Menon",
        "created_days_ago": 4,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Neha Kapoor",
                "I scheduled a technician visit for today between 9 AM and 12 PM. It's now 2 PM and no one has arrived.",
                ConversationChannel.PHONE,
                0,
            ),
            (
                SenderType.AGENT,
                "Suresh Menon",
                "I'm very sorry about this. Let me check the status of your service request.",
                ConversationChannel.PHONE,
                0.1,
            ),
            (
                SenderType.CUSTOMER,
                "Neha Kapoor",
                "I took the day off work for this. This is really inconvenient.",
                ConversationChannel.PHONE,
                0.2,
            ),
            (
                SenderType.AGENT,
                "Suresh Menon",
                "I can see the technician was assigned but there was a scheduling conflict. I'm rescheduling for tomorrow morning as a priority.",
                ConversationChannel.PHONE,
                0.4,
            ),
            (
                SenderType.CUSTOMER,
                "Neha Kapoor",
                "I need this fixed urgently. The power connection issue is affecting my home.",
                ConversationChannel.PHONE,
                0.5,
            ),
            (
                SenderType.AGENT,
                "Suresh Menon",
                "Understood. I've marked this as high priority and the technician will arrive tomorrow between 8 AM and 10 AM. I'll also send you a confirmation SMS.",
                ConversationChannel.PHONE,
                0.6,
            ),
        ],
    },
    {
        "case_number": "CASE-000007",
        "customer_code": "CUS-000010",
        "subject": "Wrong product delivered",
        "description": (
            "Customer ordered a smart meter replacement but received a different model. "
            "The delivered product does not match the order specification. Customer wants "
            "the correct product delivered or a full refund."
        ),
        "category": CaseCategory.COMPLAINT,
        "priority": CasePriority.HIGH,
        "status": CaseStatus.RESOLVED,
        "assigned_agent": "Kavita Rao",
        "created_days_ago": 5,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Rohit Menon",
                "I received my order today but it's the wrong product. I ordered the smart meter model SM-200 but got the older SM-100.",
                ConversationChannel.CHAT,
                0,
            ),
            (
                SenderType.AGENT,
                "Kavita Rao",
                "I apologize for the mix-up. Let me verify your order details and arrange for a replacement.",
                ConversationChannel.CHAT,
                0.3,
            ),
            (
                SenderType.CUSTOMER,
                "Rohit Menon",
                "I specifically ordered the newer model because of the features. This is really disappointing.",
                ConversationChannel.CHAT,
                0.6,
            ),
            (
                SenderType.AGENT,
                "Kavita Rao",
                "I understand. I've confirmed the error on our end. A replacement SM-200 will be delivered within 2 business days, and we'll arrange pickup of the wrong item.",
                ConversationChannel.CHAT,
                1.0,
            ),
            (
                SenderType.CUSTOMER,
                "Rohit Menon",
                "Thank you for resolving this quickly. I appreciate the fast response.",
                ConversationChannel.CHAT,
                1.5,
            ),
        ],
    },
    {
        "case_number": "CASE-000008",
        "customer_code": "CUS-000011",
        "subject": "Need to update registered phone number",
        "description": (
            "Customer needs to update the phone number registered on their account. "
            "The current phone number is no longer in use and the customer cannot receive "
            "OTP verification messages for account access."
        ),
        "category": CaseCategory.ACCOUNT_UPDATE,
        "priority": CasePriority.LOW,
        "status": CaseStatus.RESOLVED,
        "assigned_agent": "Rahul Verma",
        "created_days_ago": 6,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Divya Patel",
                "I need to update my phone number on my account. My old number is no longer active.",
                ConversationChannel.CHAT,
                0,
            ),
            (
                SenderType.AGENT,
                "Rahul Verma",
                "I can help you with that. Could you please verify your identity by providing your account number?",
                ConversationChannel.CHAT,
                0.2,
            ),
            (
                SenderType.CUSTOMER,
                "Divya Patel",
                "My account number is ACC10011. I also have my ID proof ready if needed.",
                ConversationChannel.CHAT,
                0.4,
            ),
            (
                SenderType.AGENT,
                "Rahul Verma",
                "Thank you for verifying. I've updated your phone number to the new one you provided. You should receive a confirmation SMS shortly.",
                ConversationChannel.CHAT,
                0.8,
            ),
            (
                SenderType.CUSTOMER,
                "Divya Patel",
                "I received the confirmation. Thank you for your help!",
                ConversationChannel.CHAT,
                1.0,
            ),
        ],
    },
    {
        "case_number": "CASE-000009",
        "customer_code": "CUS-000004",
        "subject": "Product stopped working after a few days",
        "description": (
            "Customer purchased a new electricity usage monitor that stopped working "
            "after only 3 days of use. The device was working initially but now shows "
            "a blank screen and does not respond to any buttons."
        ),
        "category": CaseCategory.COMPLAINT,
        "priority": CasePriority.MEDIUM,
        "status": CaseStatus.IN_PROGRESS,
        "assigned_agent": "Anil Desai",
        "created_days_ago": 7,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Rahul Mehta",
                "The electricity usage monitor I bought last week has stopped working. The screen is blank and it won't turn on.",
                ConversationChannel.CHAT,
                0,
            ),
            (
                SenderType.AGENT,
                "Anil Desai",
                "I'm sorry to hear that. Have you tried charging it or replacing the batteries?",
                ConversationChannel.CHAT,
                0.2,
            ),
            (
                SenderType.CUSTOMER,
                "Rahul Mehta",
                "Yes, I've tried both. It worked fine for the first 3 days and then just stopped.",
                ConversationChannel.CHAT,
                0.5,
            ),
            (
                SenderType.AGENT,
                "Anil Desai",
                "This sounds like a manufacturing defect. I'll initiate a warranty replacement for you. The new unit should arrive within 5-7 business days.",
                ConversationChannel.CHAT,
                0.8,
            ),
            (
                SenderType.CUSTOMER,
                "Rahul Mehta",
                "Will I need to return the defective unit?",
                ConversationChannel.CHAT,
                1.0,
            ),
            (
                SenderType.AGENT,
                "Anil Desai",
                "Yes, we'll arrange a pickup for the defective unit when the replacement is delivered. You'll receive tracking details via email.",
                ConversationChannel.CHAT,
                1.2,
            ),
        ],
    },
    {
        "case_number": "CASE-000010",
        "customer_code": "CUS-000002",
        "subject": "Charged twice for the same transaction",
        "description": (
            "Customer was charged twice for the same electricity bill payment. "
            "Two identical transactions appear on the customer's bank statement. "
            "Customer is requesting an immediate refund for the duplicate charge."
        ),
        "category": CaseCategory.BILLING,
        "priority": CasePriority.CRITICAL,
        "status": CaseStatus.OPEN,
        "assigned_agent": "Meera Joshi",
        "created_days_ago": 8,
        "conversations": [
            (
                SenderType.CUSTOMER,
                "Priya Sharma",
                "I was charged twice for my electricity bill payment this month. Both charges are showing on my bank statement.",
                ConversationChannel.CHAT,
                0,
            ),
            (
                SenderType.AGENT,
                "Meera Joshi",
                "I'm very sorry about this. Let me investigate the duplicate charge immediately.",
                ConversationChannel.CHAT,
                0.2,
            ),
            (
                SenderType.CUSTOMER,
                "Priya Sharma",
                "This is really frustrating. I paid my bill once and now I see two deductions. I need this resolved urgently.",
                ConversationChannel.CHAT,
                0.4,
            ),
            (
                SenderType.AGENT,
                "Meera Joshi",
                "I can confirm there was a duplicate transaction on our end. I'm initiating an immediate refund for the second charge. It should appear in your account within 3-5 business days.",
                ConversationChannel.CHAT,
                0.7,
            ),
            (
                SenderType.CUSTOMER,
                "Priya Sharma",
                "I need this refund processed as soon as possible. This is affecting my finances.",
                ConversationChannel.CHAT,
                0.9,
            ),
            (
                SenderType.AGENT,
                "Meera Joshi",
                "Understood. I've escalated this to our finance team for priority processing. You'll receive a confirmation email with the refund reference number.",
                ConversationChannel.CHAT,
                1.1,
            ),
        ],
    },
]


def _get_or_create_customer(db, customer_data: dict) -> tuple[Customer, bool]:
    """Get an existing customer by customer_code or create a new one.

    Returns (customer, created) where created is True if a new customer was added.
    """
    existing = db.scalar(
        select(Customer).where(Customer.customer_code == customer_data["customer_code"])
    )
    if existing:
        return existing, False

    customer = Customer(**customer_data)
    db.add(customer)
    db.flush()
    return customer, True


def _get_or_create_case(db, case_data: dict, customer: Customer) -> tuple[CustomerCase, bool]:
    """Get an existing case by case_number or create a new one.

    Returns (case, created) where created is True if a new case was added.
    """
    existing = db.scalar(
        select(CustomerCase).where(CustomerCase.case_number == case_data["case_number"])
    )
    if existing:
        return existing, False

    created_at = utc_now() - timedelta(days=case_data["created_days_ago"])

    case = CustomerCase(
        case_number=case_data["case_number"],
        customer_id=customer.id,
        subject=case_data["subject"],
        description=case_data["description"],
        category=case_data["category"],
        priority=case_data["priority"],
        status=case_data["status"],
        assigned_agent=case_data["assigned_agent"],
        created_at=created_at,
        updated_at=created_at,
    )

    # Set resolved_at for RESOLVED/CLOSED cases
    if case_data["status"] in (CaseStatus.RESOLVED, CaseStatus.CLOSED):
        case.resolved_at = created_at + timedelta(hours=2)

    db.add(case)
    db.flush()
    return case, True


def _add_conversations(db, case: CustomerCase, conversations: list, created_at: datetime) -> int:
    """Add conversations to a case if they don't already exist.

    Returns the number of conversations added.
    """
    existing_count = db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.case_id == case.id)
    ) or 0
    if existing_count > 0:
        return 0

    added = 0
    for sender_type, sender_name, message, channel, hours_after in conversations:
        conv = Conversation(
            case_id=case.id,
            sender_type=sender_type,
            sender_name=sender_name,
            message=message,
            timestamp=created_at + timedelta(hours=hours_after),
            channel=channel,
            created_at=created_at + timedelta(hours=hours_after),
        )
        db.add(conv)
        added += 1
    return added


def seed_demo_data() -> None:
    """Insert demo customers, cases, and conversations.

    Idempotent: running multiple times will not create duplicate records.
    """
    db = SessionLocal()
    try:
        customers_added = 0
        cases_added = 0
        conversations_added = 0

        # Create customers
        for customer_data in DEMO_CUSTOMERS:
            _, created = _get_or_create_customer(db, customer_data)
            if created:
                customers_added += 1

        # Create cases and conversations
        for case_data in DEMO_CASES:
            customer = db.scalar(
                select(Customer).where(Customer.customer_code == case_data["customer_code"])
            )
            if customer is None:
                print(f"  WARNING: Customer {case_data['customer_code']} not found, skipping case {case_data['case_number']}")
                continue

            case, case_created = _get_or_create_case(db, case_data, customer)
            if case_created:
                cases_added += 1

            created_at = utc_now() - timedelta(days=case_data["created_days_ago"])
            conversations_added += _add_conversations(
                db, case, case_data["conversations"], created_at
            )

        db.commit()

        print("✅ Demo data seeded successfully!")
        print(f"  Customers added: {customers_added}")
        print(f"  Cases added: {cases_added}")
        print(f"  Conversations added: {conversations_added}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding demo data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
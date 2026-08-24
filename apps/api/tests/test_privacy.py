import asyncio
import os
os.environ["GLOW_MASTER_KEY"] = "0" * 64
import datetime
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from glow_api.database import Base
from glow_api.models import UserAccountModel, UserPreferencesModel, ConsentRecordModel, SessionRecordModel
from glow_api.orchestrator import SessionOrchestrator
from glow_api.privacy import PrivacyService, DeletionScope
from glow_api.user import UserAccount, UserPreferences, UserLocale, SessionMode, AvatarDisclosurePreference, InputModality
from glow_api.consent import ConsentRecord
from glow_api.model_gateway import ModelGateway, GenerationRequest, GenerationResponse
from glow_api.policy import ConversationPolicyEngine
from glow_api.settings import get_settings

class MockModelGateway(ModelGateway):
    @property
    def is_configured(self) -> bool: return True
    
    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        return GenerationResponse(text="This is a mock encrypted response.", stop_reason="stop", model_id="mock", latency_ms=10, token_count=10)
        
    async def stream(self, request: GenerationRequest):
        yield "mock stream"

class MockPolicyEngine(ConversationPolicyEngine):
    def can_start_session(self, user) -> bool: return True
    def evaluate_policy(self, user):
        from glow_api.session import SessionPolicy
        return SessionPolicy(
            hard_limit_minutes=60,
            allow_pause=True,
            crisis_overrides_limit=True,
            allow_summary=True,
            is_free_session=True,
            billing_required=False
        )

@pytest.mark.asyncio
async def test_encryption_and_deletion():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    
    async with session_factory() as db:
        # Setup test user
        user_model = UserAccountModel(
            user_id="test_user_1", 
            is_adult_confirmed=True, 
            created_at=datetime.datetime.now(datetime.UTC)
        )
        db.add(user_model)
        await db.flush()
        
        pref = UserPreferencesModel(
            user_account_id=user_model.id,
            locale="EN",
            session_mode="OPEN_CONVERSATION",
            avatar_disclosure="ALWAYS_VISIBLE",
            input_modality="TEXT"
        )
        db.add(pref)
        
        # We also need a consent model or we can pass a domain model directly
        await db.commit()
        
        user_domain = UserAccount(
            user_id="test_user_1",
            is_adult_confirmed=True,
            preferences=UserPreferences(
                locale=UserLocale.EN,
                session_mode=SessionMode.OPEN_CONVERSATION,
                avatar_disclosure=AvatarDisclosurePreference.ALWAYS_VISIBLE,
                input_modality=InputModality.TEXT
            ),
            created_at=datetime.datetime.now(datetime.UTC),
            is_active=True
        )
        
        consent = ConsentRecord(
            user_id="test_user_1",
            policy_version="1.0",
            transcript_retention=True,
            session_summary=True,
            record_version=1,
            recorded_at=datetime.datetime.now(datetime.UTC),
            locale_presented="en"
        )
        
        orch = SessionOrchestrator(db, MockModelGateway(), MockPolicyEngine())
        
        # 1. Start Session
        res = await orch.start_session(user_domain, consent)
        session_id = res["session_id"]
        
        # 2. Handle Message (should encrypt)
        reply = await orch.handle_message(session_id, user_domain, consent, "Hello, this is a secret.")
        assert "mock encrypted response" in reply
        
        # 3. Export Data (Verify Decryption)
        privacy = PrivacyService(db)
        export = await privacy.export_user_data("test_user_1")
        
        assert len(export["sessions"]) == 1
        messages = export["sessions"][0]["messages"]
        assert len(messages) == 2
        assert messages[0]["content"] == "Hello, this is a secret."
        assert "mock encrypted response" in messages[1]["content"]
        
        # 4. Deletion
        del_res = await privacy.delete_user_data("test_user_1", DeletionScope.ACCOUNT_AND_ALL_DATA)
        assert del_res.success
        
        # 5. Verify Deletion
        with pytest.raises(ValueError):
            export2 = await privacy.export_user_data("test_user_1")

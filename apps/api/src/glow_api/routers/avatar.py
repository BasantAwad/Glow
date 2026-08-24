import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/avatar", tags=["avatar"])

TAVUS_API_KEY = "269548673731485cb801f91021fd8660"

@router.post("/session")
async def create_avatar_session():
    """
    Creates a new conversational video session using Tavus API.
    Returns the WebRTC conversation_url and conversation_id.
    """
    url = "https://tavusapi.com/v2/conversations"
    headers = {
        "x-api-key": TAVUS_API_KEY,
        "Content-Type": "application/json"
    }
    
    # We will pass a basic payload. If specific replica_id is required, we can catch it.
    payload = {
        "replica_id": "r79e1c033f",
        "persona_id": "p3549c1b4125"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            # For debugging, return the actual Tavus error so we can fix the payload if needed
            raise HTTPException(status_code=response.status_code, detail=response.text)
            
        data = response.json()
        return {
            "conversation_url": data.get("conversation_url"),
            "conversation_id": data.get("conversation_id")
        }

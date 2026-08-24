import asyncio
import httpx

async def main():
    url = "https://tavusapi.com/v2/conversations"
    headers = {
        "x-api-key": "269548673731485cb801f91021fd8660",
        "Content-Type": "application/json"
    }
    payload = {
        "replica_id": "r79e1c033f"
    }
    
    async with httpx.AsyncClient() as client:
        print("Calling Tavus API...")
        response = await client.post(url, headers=headers, json=payload)
        print(response.status_code)
        print(response.text)

if __name__ == "__main__":
    asyncio.run(main())

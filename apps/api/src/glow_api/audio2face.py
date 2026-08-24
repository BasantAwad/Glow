"""
Nvidia Audio2Face-3D Integration.
"""

from typing import AsyncIterator
from glow_api.voice_avatar import AvatarGateway, AudioChunk
from glow_api.settings import settings

class NvidiaA2FGateway(AvatarGateway):
    """
    Nvidia Audio2Face-3D provider implementation.
    """

    @property
    def is_configured(self) -> bool:
        return bool(settings.nvidia_api_key)

    async def get_available_avatars(self) -> list[str]:
        """
        Return the list of available therapist personas (avatars).
        """
        # Return a static list of multiple therapist personas.
        # In a real implementation, this might fetch from a Nvidia API or a database of configured rigs.
        return [
            "Dr. Sarah (Empathetic & Warm)",
            "Dr. Alex (Direct & Practical)",
            "Dr. Mei (Calm & Reflective)"
        ]

    # Future: methods to stream audio to Audio2Face and receive blendshapes/video chunks
    async def animate_audio(self, audio_stream: AsyncIterator[AudioChunk]) -> AsyncIterator[bytes]:
        """
        Sends audio chunks to the Audio2Face service and receives animation frames.
        """
        if not self.is_configured:
            raise RuntimeError("Nvidia API key not configured")
        # Placeholder for gRPC/REST interaction with Nvidia A2F
        async for chunk in audio_stream:
            # yield processed video/blendshape frames
            yield b""

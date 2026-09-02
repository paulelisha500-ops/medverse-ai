from abc import ABC, abstractmethod

from app.core.config import settings


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str) -> str:
        ...


class OpenAIProvider(LLMProvider):
    def __init__(self):
        from openai import OpenAI

        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        resp = self.client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=600,
            temperature=0.3,
        )
        return (resp.choices[0].message.content or "").strip()


class AnthropicProvider(LLMProvider):
    def __init__(self):
        import anthropic

        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        resp = self.client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=600,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return "".join(block.text for block in resp.content if block.type == "text").strip()


class OllamaProvider(LLMProvider):
    def generate(self, system_prompt: str, user_prompt: str) -> str:
        import requests

        resp = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": settings.OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return (data.get("message", {}).get("content") or "").strip()


class FallbackProvider(LLMProvider):
    """Used when no LLM provider/API key is configured. Returns the most
    relevant retrieved context directly so the app still works out of the box."""

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        context = user_prompt
        if "Question:" in user_prompt:
            context = user_prompt.split("Question:")[0]
        context = context.replace("Context:", "", 1).strip()
        snippet = context[:700] + ("..." if len(context) > 700 else "")
        if not snippet:
            snippet = "No matching information was found in the knowledge base for this question."
        return (
            "**[Demo mode — no LLM API key configured]**\n\n"
            "I can retrieve relevant information, but generating a free-form answer needs an "
            "OpenAI, Anthropic, or Ollama connection (see `backend/.env`). Here's the most "
            f"relevant information I found:\n\n{snippet}"
        )


def get_llm_provider() -> LLMProvider:
    provider = (settings.LLM_PROVIDER or "none").lower()
    try:
        if provider == "openai" and settings.OPENAI_API_KEY:
            return OpenAIProvider()
        if provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            return AnthropicProvider()
        if provider == "ollama":
            return OllamaProvider()
    except Exception:
        # If the configured provider fails to initialize (bad key, package
        # missing, etc.) gracefully degrade instead of crashing the request.
        pass
    return FallbackProvider()

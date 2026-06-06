from dataclasses import dataclass
from typing import Literal

FontFamily = Literal["cardo", "lora", "garamond", "baskerville", "georgia", "inter"]
FontSize = Literal["sm", "md", "lg", "xl"]
LineHeight = Literal["compact", "normal", "relaxed"]
LetterSpacing = Literal["tight", "normal", "loose"]
FontWeight = Literal["regular", "medium"]
TextLanguage = Literal["both", "en", "la"]


@dataclass(frozen=True)
class FontPrefs:
    font_family: FontFamily
    font_size: FontSize
    line_height: LineHeight
    letter_spacing: LetterSpacing
    font_weight: FontWeight
    text_language: TextLanguage


DEFAULT_FONT_PREFS = FontPrefs(
    font_family="cardo",
    font_size="md",
    line_height="normal",
    letter_spacing="normal",
    font_weight="regular",
    text_language="both",
)

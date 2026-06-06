from typing import Literal

from pydantic import BaseModel

from app.preferences.domain import FontPrefs

FontFamily = Literal["cardo", "lora", "garamond", "baskerville", "georgia", "inter"]
FontSize = Literal["sm", "md", "lg", "xl"]
LineHeight = Literal["compact", "normal", "relaxed"]
LetterSpacing = Literal["tight", "normal", "loose"]
FontWeight = Literal["regular", "medium"]
TextLanguage = Literal["both", "en", "la"]


class FontPrefsRequest(BaseModel):
    font_family: FontFamily
    font_size: FontSize
    line_height: LineHeight
    letter_spacing: LetterSpacing
    font_weight: FontWeight
    text_language: TextLanguage = "both"


class FontPrefsResponse(BaseModel):
    font_family: FontFamily
    font_size: FontSize
    line_height: LineHeight
    letter_spacing: LetterSpacing
    font_weight: FontWeight
    text_language: TextLanguage

    @classmethod
    def from_domain(cls, p: FontPrefs) -> "FontPrefsResponse":
        return cls(
            font_family=p.font_family,
            font_size=p.font_size,
            line_height=p.line_height,
            letter_spacing=p.letter_spacing,
            font_weight=p.font_weight,
            text_language=p.text_language,
        )

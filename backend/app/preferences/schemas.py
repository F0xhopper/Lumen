from typing import Literal

from pydantic import BaseModel

from app.preferences.domain import FontPrefs

FontFamily = Literal["cardo", "lora", "garamond", "baskerville", "georgia", "inter"]
FontSize = Literal["sm", "md", "lg", "xl"]
LineHeight = Literal["compact", "normal", "relaxed"]
LetterSpacing = Literal["tight", "normal", "loose"]
FontWeight = Literal["regular", "medium"]


class FontPrefsRequest(BaseModel):
    font_family: FontFamily
    font_size: FontSize
    line_height: LineHeight
    letter_spacing: LetterSpacing
    font_weight: FontWeight


class FontPrefsResponse(BaseModel):
    font_family: FontFamily
    font_size: FontSize
    line_height: LineHeight
    letter_spacing: LetterSpacing
    font_weight: FontWeight

    @classmethod
    def from_domain(cls, p: FontPrefs) -> "FontPrefsResponse":
        return cls(
            font_family=p.font_family,
            font_size=p.font_size,
            line_height=p.line_height,
            letter_spacing=p.letter_spacing,
            font_weight=p.font_weight,
        )

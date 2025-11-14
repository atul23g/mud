"""Task enums for type safety."""

from enum import Enum


class Task(str, Enum):
    """Supported prediction tasks."""

    HEART = "heart"
    DIABETES = "diabetes"
    PARKINSONS = "parkinsons"
    ANEMIA_TAB = "anemia_tab"
    ANEMIA_IMG = "anemia_img"
    GENERAL = "general"



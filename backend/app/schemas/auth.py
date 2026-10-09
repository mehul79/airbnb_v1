from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupIn(BaseModel):
    email: EmailStr
    # Passwords are never trimmed or altered; only length is checked.
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=60)
    age: int = Field(ge=18, le=120)


class EmailIn(BaseModel):
    email: EmailStr


class EmailExistsOut(BaseModel):
    exists: bool


class SigninIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ProfileUpdateIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    avatar_url: str | None
    age: int | None
    created_at: int  # UTC Unix seconds; the profile shows the join year

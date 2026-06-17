import argparse
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from app.db import models
from app.db.session import async_session, engine
from app.services.access_service import generate_trial_token, hash_trial_token


async def create_token(label: str, days: int, max_calls: int) -> str:
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

    token = generate_trial_token()
    username = f"trial_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    async with async_session() as db:
        existing = await db.execute(
            select(models.TrialAccess).where(models.TrialAccess.label == label)
        )
        if existing.scalars().first():
            raise RuntimeError(f"标签已存在: {label}")

        user = models.User(
            username=username,
            email=f"{username}@trial.local",
            password="!trial-access-only!",
        )
        db.add(user)
        await db.flush()
        db.add(
            models.TrialAccess(
                label=label,
                token_hash=hash_trial_token(token),
                user_id=user.id,
                expires_at=datetime.utcnow() + timedelta(days=days),
                max_calls=max_calls,
            )
        )
        await db.commit()
    return token


def main() -> None:
    parser = argparse.ArgumentParser(description="创建独立限时试用访问码")
    parser.add_argument("--label", required=True, help="访问码标签或使用人名称")
    parser.add_argument("--days", type=int, default=7, help="有效天数")
    parser.add_argument("--max-calls", type=int, default=50, help="最大聊天调用次数")
    args = parser.parse_args()
    if args.days < 1 or args.max_calls < 1:
        parser.error("days 和 max-calls 必须大于 0")
    token = asyncio.run(create_token(args.label, args.days, args.max_calls))
    print(token)


if __name__ == "__main__":
    main()

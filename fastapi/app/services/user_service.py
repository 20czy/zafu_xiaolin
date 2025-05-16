from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.models import User

class UserService:
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def create_user(self, username: str, email: str) -> User:
        """创建新用户"""
        user = User(username=username, email=email)
        self.db_session.add(user)
        await self.db_session.commit()
        await self.db_session.refresh(user)
        return user

    async def get_user_by_id(self, user_id: int) -> User:
        """通过ID获取用户"""
        result = await self.db_session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalars().first()

    async def get_user_by_username(self, username: str) -> User:
        """通过用户名获取用户"""
        result = await self.db_session.execute(
            select(User).where(User.username == username)
        )
        return result.scalars().first()

    async def get_all_users(self):
        """获取所有用户"""
        result = await self.db_session.execute(select(User))
        return result.scalars().all()

    async def delete_user(self, user_id: int) -> bool:
        """删除用户"""
        user = await self.get_user_by_id(user_id)
        if user:
            await self.db_session.delete(user)
            await self.db_session.commit()
            return True
        return False

from app.database import SessionLocal
from app.models import User
from routes.auth import get_password_hash

def reset_test_user():
    db = SessionLocal()
    try:
        # Delete existing test user if exists
        db.query(User).filter(User.username == "testuser").delete()
        
        # Create new test user
        test_user = User(
            username="testuser",
            email="testuser@example.com",
            hashed_password=get_password_hash("password"),
            is_active=True
        )
        db.add(test_user)
        db.commit()
        print("Test user reset successfully!")
    except Exception as e:
        print(f"Error resetting test user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_test_user() 
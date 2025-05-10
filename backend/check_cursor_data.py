from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys

def main():
    try:
        # Connect to the database
        engine = create_engine('sqlite:///heatgaze.db')
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get cursor data count
        cursor_count = session.execute(text("SELECT COUNT(*) FROM cursor_data")).scalar()
        print(f"Total cursor data points in database: {cursor_count}")
        
        # Check recent sessions with cursor data
        result = session.execute(text("""
            SELECT s.id, s.name, COUNT(c.id) as cursor_count
            FROM sessions s
            LEFT JOIN cursor_data c ON s.id = c.session_id
            GROUP BY s.id, s.name
            ORDER BY s.id DESC
            LIMIT 5
        """))
        
        print("\nRecent sessions with cursor data count:")
        print("ID | Name | Cursor Points")
        print("-" * 50)
        for row in result:
            print(f"{row[0]} | {row[1]} | {row[2]}")
        
        # If specific session ID is provided, show details for that session
        if len(sys.argv) > 1:
            session_id = sys.argv[1]
            print(f"\nDetails for session {session_id}:")
            
            # Get basic session info
            session_info = session.execute(text(f"SELECT id, name, created_at, updated_at FROM sessions WHERE id = {session_id}")).fetchone()
            if session_info:
                print(f"Session ID: {session_info[0]}")
                print(f"Name: {session_info[1]}")
                print(f"Created: {session_info[2]}")
                print(f"Updated: {session_info[3]}")
                
                # Get cursor data count
                cursor_count = session.execute(text(f"SELECT COUNT(*) FROM cursor_data WHERE session_id = {session_id}")).scalar()
                print(f"Cursor data points: {cursor_count}")
                
                # Get sample cursor data
                if cursor_count > 0:
                    sample = session.execute(text(f"SELECT id, timestamp, x, y FROM cursor_data WHERE session_id = {session_id} ORDER BY timestamp LIMIT 5")).fetchall()
                    print("\nSample cursor data points:")
                    for point in sample:
                        print(f"ID: {point[0]}, Time: {point[1]}, X: {point[2]}, Y: {point[3]}")
                
            else:
                print(f"Session {session_id} not found")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 
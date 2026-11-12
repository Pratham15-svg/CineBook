
CINEBOOK - PHASE 3 BACKEND SETUP GUIDE

REQUIREMENTS
1. Node.js (LTS version)
2. PostgreSQL
3. pgAdmin 4
4. Visual Studio Code

STEP 1: EXTRACT PROJECT
Extract the shared CineBook project folder.
Open the CineBook folder in VS Code.

STEP 2: RESTORE DATABASE
1. Open pgAdmin 4.
2. Create a database named cinebook.
3. Right-click the cinebook database.
4. Select Restore.
5. Select the shared cinebook_backup.dump file.
6. Set Format to Custom or tar, as appropriate.
7. Start the restore and wait for completion.

STEP 3: CONFIGURE ENVIRONMENT
1. Open the backend folder.
2. Copy .env.example.
3. Rename the copy to .env.
4. Enter your local PostgreSQL credentials.
5. Set a JWT secret of your own.
6. Save the file.

STEP 4: INSTALL DEPENDENCIES
Open a terminal inside the backend folder.

Run:
npm install

STEP 5: START BACKEND
Run:
npm.cmd run dev

STEP 6: TEST
The backend should start on the configured port.
Default expected port: 5000.

IMPORTANT
- Never share your actual .env file publicly.
- Keep the database backup file.
- Each teammate must configure their own PostgreSQL credentials.

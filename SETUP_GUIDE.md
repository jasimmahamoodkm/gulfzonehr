# GulfZone HR Management System - Setup Guide

**Version:** 1.0.0  
**Last Updated:** June 2026  
**Platform:** Windows 10 / 11  
**Estimated Setup Time:** 15-20 minutes

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Installation Checklist](#pre-installation-checklist)
3. [Step-by-Step Installation](#step-by-step-installation)
4. [Configuration](#configuration)
5. [Starting the Application](#starting-the-application)
6. [Accessing the Dashboard](#accessing-the-dashboard)
7. [Database Setup (First Time Only)](#database-setup-first-time-only)
8. [Troubleshooting](#troubleshooting)
9. [Support & Contact](#support--contact)

---

## ⚙️ System Requirements

### Minimum Requirements
- **OS:** Windows 10 or Windows 11
- **RAM:** 4 GB minimum (8 GB recommended)
- **Disk Space:** 2 GB free space
- **Internet:** Active internet connection (required for database)

### Software to Install
- **Node.js:** v18.0.0 or higher (includes npm)
- **Git:** (optional, for cloning repository)
- **Web Browser:** Chrome, Firefox, Edge, or Safari

---

## ✅ Pre-Installation Checklist

Before starting, ensure you have:
- [ ] Administrator access to your Windows machine
- [ ] Internet connection (stable, preferably broadband)
- [ ] Project folder/files (provided separately)
- [ ] `.env.local` file with credentials (provided separately)
- [ ] At least 2 GB free disk space

---

## 🚀 Step-by-Step Installation

### Step 1: Install Node.js

1. Open web browser and go to: **https://nodejs.org**
2. Download the **LTS (Long Term Support)** version
   - Currently: v20.x or v18.x
3. Run the installer (NodeJS-v*.msi)
4. **Installation Options:**
   - Click "Next" through welcome screen
   - Accept license agreement ✓
   - Use default installation path: `C:\Program Files\nodejs`
   - Check these options:
     - ✓ npm package manager
     - ✓ Add to PATH
   - Click "Next" and then "Install"
5. **Restart your computer** after installation completes

### Step 2: Verify Node.js Installation

1. Press `Win + R` to open Run dialog
2. Type `powershell` and press Enter
3. Run these commands:
   ```powershell
   node --version
   npm --version
   ```
4. **Expected output:**
   ```
   v18.x.x  (or higher)
   9.x.x    (or higher)
   ```
   ✓ If you see version numbers, installation was successful!

### Step 3: Prepare Project Folder

1. Create a folder where you want to store the project
   - Example: `C:\Projects\GulfZoneHR`
2. Extract/copy the project files into this folder
3. You should see these files/folders inside:
   ```
   📁 src/
   📁 public/
   📁 node_modules/ (don't manually create)
   📄 package.json
   📄 .env.local (you'll create this next)
   📄 next.config.js
   📄 tsconfig.json
   ... and other files
   ```

### Step 4: Set Up Environment Variables

1. Open **Notepad** or **Visual Studio Code**
2. Create a new file with this content:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://zmucqoeihukhmotzxrgs.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5ZdgMpsM-EI7IKm5QHzxIg_WUCdnnrp
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptdWNxb2VpaHVraG1vdHp4cmdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE2OTIyNywiZXhwIjoyMDkzNzQ1MjI3fQ.m4Cyq8VYnTU32SCo7flZDsLmnh_DjAvij0rPRll6i70

   # API Configuration
   NEXT_PUBLIC_API_URL=http://localhost:3000/api

   # Environment
   NODE_ENV=development
   ```
3. **Save as:** `.env.local`
   - **Important:** Save in the project root folder (same level as `package.json`)
   - In Notepad: File → Save As → "Save as type: All Files (*.*)" → name: `.env.local`

### Step 5: Install Project Dependencies

1. Open PowerShell in your project folder:
   - Right-click in the project folder
   - Select "Open PowerShell window here"
   - OR: Press `Shift + Right-click` → "Open PowerShell window here"

2. Run this command:
   ```powershell
   npm install
   ```

3. **What to expect:**
   - Takes 2-5 minutes (depends on internet speed)
   - Will show progress messages
   - Downloads ~800 MB of packages
   - Creates a `node_modules` folder (normal, don't delete)
   - ✓ Completes with: `added X packages`

---

## ⚙️ Configuration

### Verify Environment File

1. Check that `.env.local` exists in project root
2. Open it and verify all values are present (not empty)
3. **Do NOT commit or share this file** - it contains sensitive credentials

### First-Time Database Setup

If using a **new/empty database**, you need to run migrations:

1. Go to: **https://supabase.com/dashboard**
2. Log in with your credentials
3. Select your project: **zmucqoeihukhmotzxrgs**
4. Go to **SQL Editor** (left sidebar)
5. Run each migration file in order:
   - `migrations/013_fix_rls_policies.sql`
   - `migrations/014_grade_system.sql`
   - `migrations/015_grade_salary_fixed.sql`
   - `migrations/016_benefits_drop_name.sql`
   - `migrations/017_payroll_leave_deduction.sql`

Copy and paste entire file content → Click "Run" → Wait for "✓ Success"

---

## ▶️ Starting the Application

### Method 1: PowerShell (Recommended)

1. Open PowerShell in project folder
2. Run:
   ```powershell
   npm run dev
   ```
3. **Expected output:**
   ```
   ▲ Next.js 16.2.5
   - Local:        http://localhost:3000/HRportal
   - Environments: .env.local
   ```
4. Wait for message: `✓ Ready in X.XXs`

### Method 2: Using Batch File (Easier)

Create a file called `start.bat` in your project folder:

```batch
@echo off
cd /d "%~dp0"
echo Starting GulfZone HR...
npm run dev
pause
```

**To use:**
- Double-click `start.bat`
- PowerShell window opens automatically
- App starts on http://localhost:3000

### Method 3: Production Build (Testing Performance)

For faster page loads (but slower startup):

```powershell
npm run build
npm run start
```

---

## 🌐 Accessing the Dashboard

### Opening the Application

1. **Automatically:** Browser opens to http://localhost:3000/HRportal after startup
2. **Manual:** Open any browser and go to: `http://localhost:3000/HRportal`

### Login Screen

You'll see the GulfZone HR login page with:
- Email input field
- Password input field
- "Sign In" button

### Default Test Accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Super Admin | admin@gulfzone.com | (set during setup) | Full system access |
| HR Manager | hr@gulfzone.com | (set during setup) | HR operations |
| Employee | emp@gulfzone.com | (set during setup) | Limited access |

**First Time Setup:**
- Your admin should have provided credentials
- If no accounts exist, contact support to create them

### Features Available

After login, you can access:
- ✓ Dashboard with analytics
- ✓ Employee management
- ✓ Company management
- ✓ Attendance tracking
- ✓ Leave requests & approvals
- ✓ Payroll processing
- ✓ Reports generation
- ✓ Settings & configuration

---

## 🗄️ Database Setup (First Time Only)

### Running Migrations

**Important:** Only do this once when setting up a fresh database.

1. Ensure `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` populated
2. Go to Supabase SQL Editor
3. Run migrations in this order:
   ```sql
   -- First: Fix RLS policies
   -- Run: migrations/013_fix_rls_policies.sql
   
   -- Second: Create grade system
   -- Run: migrations/014_grade_system.sql
   
   -- Third: Fix salary column
   -- Run: migrations/015_grade_salary_fixed.sql
   
   -- Fourth: Remove benefit names
   -- Run: migrations/016_benefits_drop_name.sql
   
   -- Fifth: Add leave deduction
   -- Run: migrations/017_payroll_leave_deduction.sql
   ```

4. Each should show: `✓ Success` before moving to next

### Verifying Database Connection

In PowerShell, the app will show:
- ✓ Connected to Supabase
- ✓ All tables accessible
- ✓ RLS policies active

If errors appear, check:
- Internet connection is active
- `.env.local` credentials are correct
- Database hasn't been deleted

---

## 🔧 Troubleshooting

### Problem: "npm: The term 'npm' is not recognized"

**Solution:**
1. Restart your computer (Node.js PATH needs refresh)
2. If still fails, reinstall Node.js
3. Verify in `Control Panel` → `System` → `Advanced` → `Environment Variables`
   - Look for `NODE_HOME` or `NODEJS_HOME`

---

### Problem: "Port 3000 is already in use"

**Solution 1:** Use a different port
```powershell
npm run dev -- -p 3001
```
Then access app at: `http://localhost:3001`

**Solution 2:** Kill the process using port 3000
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
npm run dev
```

---

### Problem: ".env.local file not found"

**Solution:**
1. Check file is in project root (same folder as `package.json`)
2. In Notepad, when saving, choose:
   - Save as type: **All Files (*.*)**
   - Filename: `.env.local` (including the dot)
3. If hidden, enable "Show hidden files":
   - Folder view options → View tab → uncheck "Hide extensions..."

---

### Problem: "Cannot find module" or "Dependency not found"

**Solution:**
```powershell
# Clear node_modules
rmdir /s /q node_modules

# Clear npm cache
npm cache clean --force

# Reinstall
npm install

# Run again
npm run dev
```

---

### Problem: "Supabase connection failed"

**Solution:**
1. Check internet connection is active
2. Verify credentials in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` starts with `https://`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is not empty
   - `SUPABASE_SERVICE_ROLE_KEY` is not empty
3. Test Supabase connection:
   - Go to https://supabase.com/dashboard
   - Log in successfully
   - If login fails, contact database administrator

---

### Problem: "Blank page or 404 error"

**Solution:**
1. Check console (F12 → Console tab) for errors
2. Ensure app is running (check PowerShell for "Ready in X.XXs")
3. Try hard refresh: `Ctrl + Shift + R`
4. Clear browser cache: `Ctrl + Shift + Delete`

---

### Problem: "Build takes too long or crashes"

**Solution:**
1. Close other applications using RAM
2. Increase available memory
3. Run build separately:
   ```powershell
   npm run build
   # Wait for completion
   npm run start
   ```

---

### Problem: "Login doesn't work or page keeps redirecting"

**Solution:**
1. Verify database migrations were run
2. Check user account exists in Supabase
3. Clear browser cookies: `Ctrl + Shift + Delete` → Cookies & cached images
4. Try incognito mode: `Ctrl + Shift + N`
5. Check console (F12) for error messages

---

## ⛔ Stopping the Application

### Stop the Server

1. In PowerShell window running the app
2. Press `Ctrl + C`
3. Confirm with `Y` if prompted
4. You'll see: `Terminating...`

### Restart

Simply run `npm run dev` again in PowerShell

---

## 📞 Support & Contact

### Common Questions

**Q: Can I access this from my phone?**
- A: Only from same Wi-Fi. Replace `localhost` with your computer's IP address (run `ipconfig` in PowerShell to find it)

**Q: Is my data secure locally?**
- A: Yes. Data is encrypted in transit and stored securely in Supabase database

**Q: How do I backup my data?**
- A: Backups are handled by Supabase. Contact database admin for backup procedures

**Q: Can multiple people use this on different computers?**
- A: Yes. Deploy to a server (Vercel, AWS, etc.) for multi-user remote access

**Q: What if I close the PowerShell window?**
- A: App stops. Run `npm run dev` again to restart

### Technical Support

For issues not covered in this guide:

1. **Check error logs:**
   - Look at PowerShell window for error messages
   - Open browser console (F12 → Console tab)

2. **Screenshot the error:**
   - Include full error message
   - Include steps to reproduce

3. **Contact Support:**
   - Email: support@gulfzone.com
   - Include:
     - Windows version (Run `winver`)
     - Node.js version (Run `node --version`)
     - Error screenshot
     - Steps you took before error

### Documentation

- Full documentation: `/README.md`
- API documentation: `/docs/API.md`
- Database schema: `/migrations/`

---

## ✨ You're All Set!

Congratulations! Your GulfZone HR system is now running locally.

**What's Next:**
1. [ ] Create admin user account
2. [ ] Add your first company
3. [ ] Import employees
4. [ ] Configure grades & benefits
5. [ ] Set up leave types
6. [ ] Start tracking attendance

Enjoy using GulfZone HR! 🎉

---

**Document Version:** 1.0  
**Last Updated:** June 2026  
**Next Review:** December 2026

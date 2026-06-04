# 👋 Welcome to GulfZone HR Management System

Thank you for choosing GulfZone HR! This folder contains everything you need to run the application on your Windows computer.

---

## 📚 Documentation Guide

This package includes several guides. **Start with the one that matches your needs:**

### 🚀 **Just want to get started?**
👉 **Read:** `QUICK_START.md` (1 page, 5 minutes)
- Super quick setup instructions
- Copy-paste ready environment variables
- Common commands at a glance

### 📖 **Need detailed step-by-step guide?**
👉 **Read:** `SETUP_GUIDE.md` (comprehensive, 20 pages)
- Detailed instructions with screenshots
- Complete troubleshooting section
- Verification steps at each stage
- FAQ and common issues

### ⚡ **Prefer to just double-click?**
👉 **Use:** `start.bat` (batch file)
- Double-click to start the application
- Automatic setup on first run
- No PowerShell knowledge required

### 🏢 **Deploying for multiple teams?**
👉 **Use:** `DEPLOYMENT_CHECKLIST.md`
- Verify everything is working
- Client handover checklist
- Sign-off documentation

---

## 🎯 Quick Setup (2 Steps)

### Step 1: Install Node.js
1. Download from: https://nodejs.org (LTS version)
2. Run installer, click "Next" → "Install"
3. Restart your computer

### Step 2: Create `.env.local`
Create a file named `.env.local` in this folder with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://zmucqoeihukhmotzxrgs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5ZdgMpsM-EI7IKm5QHzxIg_WUCdnnrp
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptdWNxb2VpaHVraG1vdHp4cmdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE2OTIyNywiZXhwIjoyMDkzNzQ1MjI3fQ.m4Cyq8VYnTU32SCo7flZDsLmnh_DjAvij0rPRll6i70
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
```

### Step 3: Start the App
**Option A (Easiest):** Double-click `start.bat`
**Option B (PowerShell):** Run `npm install` then `npm run dev`

### Step 4: Open Browser
Go to: **http://localhost:3000/HRportal**

---

## 📁 File Structure

```
📦 GulfZone HR
├── 📄 QUICK_START.md              ← Start here (1 page)
├── 📄 SETUP_GUIDE.md              ← Full guide (20 pages)
├── 📄 DEPLOYMENT_CHECKLIST.md     ← For IT teams
├── 🔧 start.bat                   ← Double-click to run
├── 🔧 start-production.bat        ← For production testing
├── 📄 .env.local                  ← Create this (environment config)
├── 📁 src/                        ← Source code
├── 📁 public/                     ← Static files
├── 📁 node_modules/               ← Dependencies (auto-created)
└── 📄 package.json                ← Project configuration
```

---

## ✅ What's Included

✓ **Full Application Source Code**
- Employee management system
- Payroll processing
- Leave management
- Attendance tracking
- Reporting & analytics

✓ **Database Setup**
- Pre-configured Supabase connection
- All tables already created
- Automatic backups enabled

✓ **Documentation**
- Beginner-friendly setup guide
- Quick reference card
- Troubleshooting guide
- Deployment checklist

✓ **Helper Scripts**
- Automatic startup (start.bat)
- Production testing (start-production.bat)

---

## 🎓 First Time Users

1. **Install Node.js** (required once)
2. **Create `.env.local`** (required once)
3. **Double-click `start.bat`** (every time you want to use the app)
4. **Open http://localhost:3000** in your browser
5. **Login** with provided credentials

That's it! The app does the rest.

---

## ❓ Common Questions

**Q: How do I start the application?**
A: Double-click `start.bat` or run `npm run dev` in PowerShell

**Q: What if I get an error?**
A: Check `SETUP_GUIDE.md` → Troubleshooting section

**Q: Can I access it from my phone?**
A: Only from same Wi-Fi. Use your computer's IP instead of `localhost`

**Q: Is my data safe?**
A: Yes. All data is encrypted and backed up daily in Supabase

**Q: How do I update the application?**
A: Contact your system administrator

**Q: What's Node.js?**
A: It's the engine that runs this application. Similar to Java Runtime.

---

## 🔗 Important URLs

| Resource | URL |
|----------|-----|
| Application | http://localhost:3000 |
| Supabase Dashboard | https://supabase.com/dashboard |
| Node.js Download | https://nodejs.org |
| Support | (provided separately) |

---

## 📞 Need Help?

### Before Contacting Support
1. Check `SETUP_GUIDE.md` → Troubleshooting
2. Verify Node.js is installed: `node --version` in PowerShell
3. Verify `.env.local` exists in this folder
4. Check for error messages in PowerShell window

### When Contacting Support
Provide:
- Windows version (Run `winver`)
- Node.js version (Run `node --version`)
- Screenshot of the error
- Steps you took before the error occurred
- Contact: support@gulfzone.com

---

## 🚀 Getting Started Now

### Option 1: Zero Click (Recommended)
```
1. Double-click → start.bat
2. Wait for: "Ready in X.XXs"
3. Browser opens automatically
4. Done!
```

### Option 2: PowerShell
```powershell
# Open PowerShell in this folder, then run:
npm install
npm run dev

# Open browser to: http://localhost:3000
```

### Option 3: Read the Full Guide First
Read `SETUP_GUIDE.md` for detailed step-by-step instructions with screenshots.

---

## 📋 System Requirements

- **OS:** Windows 10 or 11
- **RAM:** 4 GB minimum (8 GB recommended)
- **Disk Space:** 2 GB free
- **Internet:** Required (for database connection)

---

## ✨ What You Get

After setup, you can:
- ✓ Manage employees and departments
- ✓ Track attendance
- ✓ Process payroll automatically
- ✓ Manage leave requests
- ✓ Generate reports
- ✓ Configure company settings
- ✓ Manage user roles and permissions

---

## 📅 Version Information

- **Application Version:** 1.0.0
- **Database:** Supabase (PostgreSQL)
- **Framework:** Next.js 16.2.5
- **Language:** TypeScript
- **Last Updated:** June 2026

---

## 🎉 You're Ready!

Everything is set up and ready to go. Pick your preferred setup method above and get started in minutes.

**Questions?** Check the documentation or contact support.

**Happy HR Management!** 🎊

---

*Need the full setup guide? Read `SETUP_GUIDE.md`*  
*In a hurry? Use `QUICK_START.md`*  
*Just want to run it? Double-click `start.bat`*

# GulfZone HR - Quick Start (One Page)

## 🚀 5-Minute Setup

### Prerequisites
- Windows 10/11
- 4 GB RAM, 2 GB disk space
- Internet connection

### Installation

**1. Install Node.js**
- Download: https://nodejs.org (LTS version)
- Run installer, accept defaults
- Restart computer

**2. Create `.env.local`** in project folder with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://zmucqoeihukhmotzxrgs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5ZdgMpsM-EI7IKm5QHzxIg_WUCdnnrp
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptdWNxb2VpaHVraG1vdHp4cmdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE2OTIyNywiZXhwIjoyMDkzNzQ1MjI3fQ.m4Cyq8VYnTU32SCo7flZDsLmnh_DjAvij0rPRll6i70
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
```

**3. Open PowerShell in project folder**
```powershell
npm install
```

**4. Start app**
```powershell
npm run dev
```

**5. Open browser**
- Go to: http://localhost:3000/HRportal
- Login with provided credentials

---

## ⚡ Common Commands

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Start on port 3001 | `npm run dev -- -p 3001` |
| Build for production | `npm run build` |
| Run production build | `npm run start` |
| Check TypeScript | `npx tsc --noEmit` |
| Stop server | `Ctrl + C` |

---

## 🔍 Verify Installation

```powershell
node --version      # Should be v18+
npm --version       # Should be v9+
npm list next       # Should show Next.js 16+
```

---

## ❌ Quick Fixes

| Problem | Fix |
|---------|-----|
| "npm not found" | Restart computer after Node.js install |
| Port 3000 in use | `npm run dev -- -p 3001` |
| `.env.local` not found | Save in project root as "All Files (*.*)" |
| Blank page | Press `Ctrl + Shift + R` (hard refresh) |
| Module not found | Run `npm install` again |
| Supabase error | Check internet + `.env.local` credentials |

---

## 📁 Project Structure

```
GulfZoneHR/
├── src/              # Source code
│   ├── app/         # Pages & routes
│   ├── components/  # React components
│   ├── lib/         # Utilities
│   └── types/       # TypeScript types
├── public/          # Static files
├── migrations/      # Database migrations
├── .env.local       # Environment variables (CREATE THIS)
├── package.json     # Dependencies
└── SETUP_GUIDE.md   # Full setup guide
```

---

## 🎯 First Steps After Login

1. Create admin account (if needed)
2. Add company information
3. Create employee grades
4. Import employees
5. Configure leave types
6. Start tracking attendance

---

## 📞 Need Help?

**Full Guide:** Read `SETUP_GUIDE.md` in project folder

**Quick Issues:**
- Check PowerShell for error messages
- Press F12 in browser to see console errors
- Verify `.env.local` file exists

**Support:** Contact system administrator

---

**Status:** ✅ Ready to Deploy  
**Version:** 1.0  
**Updated:** June 2026

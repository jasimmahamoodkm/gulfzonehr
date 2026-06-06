/**
 * PM2 process definition for GulfZone HR (Next.js production server).
 *
 * Usage (from the app folder, e.g. C:\apps\GulfZoneHR):
 *   pm2 start deploy/windows/ecosystem.config.js
 *   pm2 save
 *
 * PM2 keeps the app alive, restarts it on crash, and (with
 * pm2-windows-startup installed) relaunches it after a server reboot.
 *
 * The app reads Supabase credentials from .env.local at the project root,
 * so they are NOT duplicated here. NEXT_PUBLIC_* values are baked in at
 * build time; server-only values (SUPABASE_SERVICE_ROLE_KEY) are read at
 * runtime from the environment / .env.local.
 */
module.exports = {
  apps: [
    {
      name: 'gulfzone-hr',
      // Run the Next.js production server (package.json "start" => next start)
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname.replace(/[\\/]deploy[\\/]windows$/, ''), // project root
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      // Logs (created automatically)
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};

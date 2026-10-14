#!/bin/sh
set -eu

cd "$(dirname "$0")"
exec vercel --prod --scope aditps-projects

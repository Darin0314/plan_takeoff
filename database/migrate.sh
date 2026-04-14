#!/bin/bash
# Run from project root
MYSQL_USER="plan_takeoff_user"
MYSQL_PASS="plan_takeoff_pass"
DB_NAME="plan_takeoff"

echo "Creating database and user..."
sudo mysql -e "
CREATE DATABASE IF NOT EXISTS plan_takeoff CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
"

echo "Running schema..."
sudo mysql plan_takeoff < /home/smokeshow/code/plan_takeoff/database/schema.sql

echo "Done."

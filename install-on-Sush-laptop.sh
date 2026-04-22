to install on Sush latop

Install Node.js v22 — download from https://nodejs.org (LTS version)
Install Git — https://git-scm.com/downloads

node -v   # should show v22.x
git --version

On your son's laptop — Clone and run
# Clone the repo
git clone https://github.com/YOUR_USERNAME/mithai-shop.git
cd mithai-shop

# Install dependencies
npm install

# Run dev server
npm run dev

Opens at http://localhost:3000.

Step 4: Git setup on his laptop
# Tell git who he is
git config --global user.name "Son's Name"
git config --global user.email "his@email.com"

# After making changes, commit and push:
git add .
git commit -m "describe what changed"
git push


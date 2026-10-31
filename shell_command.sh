cd /Users/sm/github/Portfolio
unzip ~/Downloads/portfolio-m1.zip -d /tmp/pf-m1
cp -R /tmp/pf-m1/portfolio/. .
git status
npm install
npm run check
git add -A && git commit -m "Add portfolio site shell (M1), data, analysis, tests"
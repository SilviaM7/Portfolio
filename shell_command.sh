cd /Users/sm/github/Portfolio
unzip ~/Downloads/portfolio-m1.zip -d /tmp/pf-m1
cp -R /tmp/pf-m1/portfolio/. .        # the trailing /. also copies dotfiles like .github and .gitignore
git status                            # review before committing
npm install                           # creates package-lock.json
npm run check
git add -A && git commit -m "Add portfolio site shell (M1), data, analysis, tests"
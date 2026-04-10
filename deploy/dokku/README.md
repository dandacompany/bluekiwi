<!-- deploy/dokku/README.md -->
# Dokku Deployment

```bash
dokku apps:create bluekiwi
dokku postgres:create bluekiwi-db
dokku postgres:link bluekiwi-db bluekiwi
dokku config:set bluekiwi JWT_SECRET=$(openssl rand -hex 32)
dokku git:set bluekiwi deploy-branch main
git remote add dokku dokku@your.server:bluekiwi
git push dokku main
```

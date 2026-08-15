# Local Preview Worktree

When a preview checkout uses the same MongoDB as the main checkout, copy or link the upload folder too:

```sh
cp -R /Users/ravibyakod/WORK/mithai-shop/mithai-shop/media ./media
```

Payload media records store filenames in MongoDB, but the image bytes live on disk under `media/`. If the folder is missing, product image URLs like `/api/media/file/...` return 500 and catalog/PDP images look blank.

After starting the dev server, run:

```sh
node scripts/check-media-health.mjs http://127.0.0.1:3002
```

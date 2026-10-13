# Shared Storage policy ? 12 October 2026

Applies to Firebase project `gothai-ffea1`, bucket `gothai-ffea1.firebasestorage.app`, the mobile client, Thaiseva website, admin portal and Rishav Food portal. All three application `storage.rules` copies must match. This change does not deploy or synchronize Firestore rules.

## Access policy

| Path | Read | Upload/update/delete |
| --- | --- | --- |
| `profile_pics/{uid}.jpg` | Public | Owner; JPEG only, up to 15 MiB; owner deletion |
| `uploads/{uid}/**` | Admin or food master | Signed-in owner creates up to 15 MiB; no overwrites even by admins; admin deletion |
| `food_orders/{uid}/**` | All signed-in users, as requested | Owner images up to 15 MiB; owner/admin deletion |
| `site-media/**` | Public | Admin, up to 50 MiB |
| `images`, `restaurantImages`, `blogImages`, `hotelImages`, `hotel-images`, `serviceImages` | Public | Admin/food master, images up to 15 MiB |
| `users/{uid}/**` | Owner/admin | Owner/admin, up to 15 MiB |
| `partners`, `hotels`, `HotelDB` owner folders | Owner/admin | Owner/admin, up to 15 MiB |
| Their `media/**` subfolders | Public | Owner/admin images up to 15 MiB |
| `restaurants/{uid}/documents/**` | Owner/admin/food master | Owner creates only; admin/food master manages; images/PDF up to 15 MiB |
| Restaurant root images and `media`, `images`, `menu`, `profile`, `items` | Public | Owner/admin/food master images up to 15 MiB |
| `applications/{id}/**` | Admin/food master through Storage | Direct writes denied; existing validated public backend accepts application files up to 8 MiB |
| `chat`, `chats`, `chatMedia` sender folders | Sender/admin/food master | Sender writes, up to 20 MiB |
| Legacy root `{timestamp}-file` | Public | New writes denied |
| Other paths | Denied | Denied |

Admin means backend-issued `admin: true`, or a protected `users/{uid}` / `Users/{uid}` role of `Admin`, `admin`, or `Sub Admin`. Lowercase `users` takes precedence. Food master requires `foodRole: masterAdmin` or `foodMasterAdmin: true` custom claims. A signed-in account, an email address, or a self-assigned profile flag is not sufficient. Ensure Firestore prevents users from elevating these roles. Cross-service role checks require Firebase Rules access to Firestore.

## Client compatibility

Mobile support uploads must sign in, use `uploads/{auth.uid}/{uniqueName}`, and store the object path. Reading metadata or calling `getDownloadURL` after upload is denied for non-admin submitters; mobile must not depend on that call to complete submission. Use authenticated SDK reads for restricted files. The mobile source is not present in these three repositories, so its upload behavior still needs a device check.

Admin catalog uploads now use `images/{uuid}` instead of the bucket root. Partner hotel/local-service profile uploads use `partners/{uid}/media/{uuid}`. Driver profile and onboarding images use private `users/{uid}/files/{uuid}` paths. Partner/driver signup previews files locally and uploads after account creation; admin-created partner images use the administrator's private folder. The sightseeing form's `hotel-images` folder is now covered. Existing root image reads remain compatible. Files are not moved or deleted.

Public food applications still use `uploadPublicApplicationContent`, which validates file signatures, size, application expiry and upload count. Backend Admin SDK operations bypass Storage rules and must keep their own authorization and validation.

## Privacy limitations

This is an access-control update, not Thailand PDPA compliance certification. Order photos are accessible to every signed-in user by the owner's requested policy and may reveal personal locations. Legacy chat/private document clients still use token download URLs: possession of an existing bearer link can allow access independently of these rules. This deployment does not revoke existing tokens, migrate chat clients, or change retention/consent notices. The public/private distinction applies to authenticated Storage rule requests; bucket IAM, signed URLs and server operations require separate control.

MIME checks validate declared metadata, not actual bytes. Private application uploads additionally validate signatures in the backend. Regular direct uploads should not be considered malware-scanned.

## Validation and deployment

Eight shared emulator tests passed, covering public JPEG ownership and exact size boundary, immutable support submissions, signed-in order reads, public catalog permissions, private documents, food menu/application/chat compatibility, protected role fallback, and identical rule copies. Admin Vite production build passed; existing bundle/eval warnings remain.

From the food repository, run the portable Storage tests:

```powershell
firebase emulators:exec --project demo-thaiseva-security --config firebase.storage-test.json --only 'firestore,storage' 'node --test tests/storageRules.test.cjs'
```

Storage is deployed centrally from `D:/projects/Thaiseva-Firebase-Security`:

```powershell
firebase deploy --project gothai-ffea1 --only storage
```

Do not run the existing all-rules sync/deploy script for this task: local Firestore copies differ and are outside this update. The admin frontend is deployed with `firebase deploy --project gothai-ffea1 --only hosting:gothai-admin` from its repository. Website and food runtime code do not change; their updated rules files are source copies of the centrally deployed bucket policy.

Deployment verification is recorded separately after publication.

## Deployment result

Storage deployed successfully on 12 October 2026 at 10:15 PM IST. Live ruleset `3870063e-8b5d-4ce7-9ac6-3ae171066e33` matches SHA-256 `3bc986783db770d40bed00406a70eb3c6c7d814ae79d860e6a4c162e2d198d7e`. The Firestore release remained `f1f68eb8-3000-4de3-a8db-8a1c604fc720`, unchanged from the pre-deployment snapshot.

Admin hosting deployed successfully at approximately 10:16 PM IST to https://gothai-admin.web.app (Hosting version `f9a40a4c4adea788`). The website and food portal use the same deployed bucket policy and need no hosting deployment for these rule/doc-only changes.

Previous live rules used 25 MiB for several general uploads; this policy applies the local project's 15 MiB limit to those paths. Site media remains 50 MiB and legacy chat 20 MiB. Previously stored larger files are not deleted and remain readable under the path's read policy.

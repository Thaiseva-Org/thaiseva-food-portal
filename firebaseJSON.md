{
  "hosting": {
    "site": "thaiseva-food-portal",
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}


firebase deploy --only hosting:thaiseva-food-portal
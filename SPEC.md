# CHYOA Downloader

## Overview
This typescript project is a cli application that takes in a story URL from the website [chyoa.com](https://chyoa.com/) and markdown files of the story content from that story as well as all parent stories.

## Specifics
chyoa.com is a choose your own adventure branching-story site where every story can have multiple child stories that take the narrative in different directions. The point of this application is to take in the URL of some story in the tree and download the story content from that story and all of its parent stories to local storage.

chyoa.com allows images to be embedded within stories but will only allow you to view them if you're logged in. This application should download those images, save them to local storage, and update the resultant markdown stories so they reference the local copies using standard Markdown image syntax. As such, this applicaiton will need to implement some mechanism to authenticate with chyoa.com.
'Story images' that need to be downloaded are those that are within the <div class="chapter-content"> div.

The final markdown should contain the following:
- Link to the original chyoa page
- Title
- Author
- Story content (chapter-content div) formatted the same as the original HTML with embedded links to the locally downloaded images

## Required Technologies
- Typescript
- Bun
- Yargs (for cli arg parsing)
- Puppeteer for downloading (to avoid Cloudflare protections and for re-using browser credentials)

## Testing
No unit test files are required, manual testing will work.
Please test with this story: https://chyoa.com/chapter/The-great-east-shift-%28race-change%29-Michelle.1392983
  - It has had its html already downloaded for testing in example.html
  - This story itself contains two embedded images that need to be downloaded and its parents contain more
  -That story has 3 parents (for a total of 4 stories that need to be downloaded) as well as images, so it should make for a good test case.

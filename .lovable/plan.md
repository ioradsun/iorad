

# Wire Library URL into the Embed Demo Section

## What's happening now
- The `EmbedDemo` component has a hardcoded iframe URL: `https://ior.ad/b973?iframeHash=trysteps-1`
- The snapshot JSON already contains `reinforcement_preview` with `library_url` and `detected_tool`, parsed into `customer.reinforcementPreview`
- But this data is never passed to `EmbedDemo` -- the component doesn't receive any props

## Plan

### 1. Pass `reinforcementPreview` to `EmbedDemo`
In `CustomerStory.tsx`, update the `<EmbedDemo />` call to pass the customer's `reinforcementPreview` data:
```
<EmbedDemo reinforcementPreview={displayCustomer.reinforcementPreview} />
```

### 2. Update `EmbedDemo` to use `libraryUrl` for the iframe
In `EmbedDemo.tsx`:
- Accept a `reinforcementPreview` prop (optional)
- If `reinforcementPreview.libraryUrl` exists, use it as the iframe `src`
- If not, fall back to the current hardcoded iorad tutorial URL (`https://ior.ad/b973?iframeHash=trysteps-1`)
- Optionally show the `detected_tool` name and `description` from the preview data in the section text (replacing or supplementing the defaults)

### 3. Update default text when a library is detected
When a library URL is present, the description text can be pulled from `reinforcementPreview.description` instead of the hardcoded default, giving a more tailored message about the specific tool detected.

---

### Technical Details

**File: `src/pages/CustomerStory.tsx`**
- Line ~418: Change `<EmbedDemo />` to `<EmbedDemo reinforcementPreview={displayCustomer.reinforcementPreview} />`

**File: `src/pages/story/EmbedDemo.tsx`**
- Add prop interface: `{ reinforcementPreview?: ReinforcementPreview }`
- Compute iframe URL: `reinforcementPreview?.libraryUrl || "https://ior.ad/b973?iframeHash=trysteps-1"`
- Use `reinforcementPreview?.description` as default description text when available
- Keep overrides logic intact (overrides still take priority)


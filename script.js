let userPublicKey = '';
let userAddress = '';
let userName = '';
let allResults = [];
let metadataArray = [];
// Pagination variables
let currentPage = 1;
let itemsPerPage = 10;
let totalResults = 0;
let totalSize = 0;
let currentServiceFilter = 'ALL'; // 'ALL' means no service filter
const infoDetails =
    `<img src="red-x.svg" style="width:15px;height:15px;">
    Click the identifier to "delete" content.<br>
    (This will replace it with a blank file.)<br>
    <br>
    <img src="file-up.png" style="width:15px;height:15px;">
    Click the file select icon to "edit" content.<br>
    (This will replace it with a selected file.)`;
const contentPage = document.getElementById('content-page');
document.getElementById('login-button').addEventListener('click', accountLogin);
document.getElementById('items-per-page-dropdown').addEventListener('change', function() {
    itemsPerPage = parseInt(this.value, 10);
    currentPage = 1; // Reset to the first page
    fetchPage();
});
document.getElementById('service-filter-dropdown').addEventListener('change', function() {
    currentServiceFilter = this.value;
    currentPage = 1;
    // After changing service, we need to recalculate totalResults and then fetch that page.
    fetchTotalCount(currentServiceFilter).then(() => fetchPage());
});

async function accountLogin() {
    try {
        const account = await qortalRequest({
            action: "GET_USER_ACCOUNT"
        });
        contentPage.style.display = "block";
        document.getElementById('account-details').innerHTML = 'Loading...';
        userAddress = account.address ? account.address : 'Address unavailable';
        userPublicKey = account.publicKey ? account.publicKey : 'Public key unavailable';
        
        let names = [];
        if (userAddress !== 'Address unavailable') {
            names = await qortalRequest({
                action: "GET_ACCOUNT_NAMES",
                address: userAddress
            });
        }
        userName = names.length > 0 && names[0].name ? names[0].name : 'Name unavailable';
        document.getElementById('info-details').innerHTML = infoDetails;
        document.getElementById('account-details').innerHTML = `${userAddress}<br>${userName}`;
        // First, get total count of all results and build service dropdown
        await fetchTotalCount('ALL');
        await buildServiceDropdown();
        fetchPage();
    } catch (error) {
        console.error('Error fetching account details:', error);
        document.getElementById('account-details').innerHTML = `Error fetching account details: ${error}`;
    }
}

async function fetchTotalCount(service) {
    if (!userName || userName === 'Name unavailable') {
        return;
    }
    // We fetch all results without limit to count them.
    // If the API doesn't support a count header, we'll just get all items and count their length.
    let serviceQuery = '';
    if (service !== 'ALL') {
        serviceQuery = `&service=${encodeURIComponent(service)}`;
    }
    // Make a single call with no limit specified to get all results.
    // If the API returns all results when limit is not specified, this works.
    // If the API requires a large limit, set a sufficiently large number.
    const response = await fetch(`/arbitrary/resources/search?name=${userName}&includemetadata=true&exactmatchnames=true&mode=ALL${serviceQuery}`);
    if (!response.ok) {
        console.error('Error fetching total count');
        totalResults = 0;
        return;
    }
    const allData = await response.json();
    totalResults = allData.length;
    totalSize = allData.reduce((acc, r) => acc + r.size, 0);
}

async function buildServiceDropdown() {
    // Fetch all results (from the previous fetchTotalCount('ALL') we have totalResults but no "allResults" here)
    // To build the dropdown, we need to know all unique service types.
    // We'll do a one-time fetch (like in fetchTotalCount) to get the full list again and store them.
    const response = await fetch(`/arbitrary/resources/search?name=${userName}&includemetadata=true&exactmatchnames=true&mode=ALL`);
    if (!response.ok) {
        console.error('Error fetching all content for service dropdown');
        return;
    }
    const fullResults = await response.json();
    const serviceTypesSet = new Set();
    for (const result of fullResults) {
        serviceTypesSet.add(result.service);
    }
    const serviceTypes = Array.from(serviceTypesSet);
    const filterOptions = document.getElementById('service-filter-dropdown');
    filterOptions.innerHTML = ''; // Clear existing (if any)
    // Add the ALL option
    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = 'ALL';
    filterOptions.appendChild(allOption);
    // Add one option per service
    for (const svc of serviceTypes) {
        const opt = document.createElement('option');
        opt.value = svc;
        opt.textContent = svc;
        filterOptions.appendChild(opt);
    }
}

async function fetchPage() {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }
        document.getElementById('content-details').innerHTML = '<p>Loading...</p>';
        const offset = (currentPage - 1) * itemsPerPage;
        let serviceFilterQuery = '';
        if (currentServiceFilter !== 'ALL') {
            serviceFilterQuery = `&service=${encodeURIComponent(currentServiceFilter)}`;
        }
        // Get a single page of results
        const response = await fetch(`/arbitrary/resources/search?name=${userName}&includemetadata=true&exactmatchnames=true&mode=ALL&limit=${itemsPerPage}&offset=${offset}${serviceFilterQuery}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const pageResults = await response.json();
        allResults = pageResults; // Store current page results
        buildContentTable(allResults);
    } catch (error) {
        console.error('Error fetching page:', error);
        document.getElementById('content-details').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

function buildContentTable(results) {
    const contentDetailsDiv = document.getElementById('content-details');
    const contentSummaryDiv = document.getElementById('content-summary');
    if (results.length > 0) {
        results.sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
        let tableHtml = '<table>';
        tableHtml += `
            <tr>
                <th>Service</th>
                <th>Identifier</th>
                <th>Metadata</th>
                <th>Preview</th>
                <th>Size</th>
                <th>Created / Updated</th>
            </tr>
        `;
        metadataArray = []; // Reset metadataArray
        for (const result of results) {
            let identifier = (result.identifier === undefined) ? 'default' : result.identifier;
            let createdString = new Date(result.created).toLocaleString();
            let updatedString = new Date(result.updated).toLocaleString();
            if (isNaN(new Date(result.created))) {
                createdString = 'Unknown';
            }
            if (isNaN(new Date(result.updated))) {
                updatedString = 'Never';
            }
            let sizeString = formatSize(result.size);
            let metadataKeys = '';
            let metadataIndex = -1;
            if (result.metadata) {
                metadataIndex = metadataArray.length;
                metadataArray.push(result.metadata);
                metadataKeys = Object.keys(result.metadata).join(', ');
            }
            tableHtml += `<tr>
                <td>${result.service}</td>
                <td><span data-service="${result.service}" data-identifier="${identifier}"` +
                (((result.service !== 'APP') && (result.service !== 'WEBSITE') && (result.service.slice(-8) !== '_PRIVATE')) ? `class="clickable-delete"><img src="red-x.svg" style="width:15px;height:15px;"` : '>') + `${identifier}</span></td>
                <td><span class="clickable-metadata" data-metadata-index='${metadataIndex}'>${metadataKeys}</span></td>
                <td>` + generatePreviewHTML(result, userName, identifier) + `</td>
                <td>${sizeString}</td>
                <td>${createdString}<br>${updatedString}</td>
            </tr>`;
        }
        tableHtml += `</table>`;
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(startItem + itemsPerPage - 1, totalResults);
        contentSummaryDiv.innerHTML = `<p>${startItem}-${endItem} of ${totalResults} results</p><p>Total Size: ${formatSize(totalSize)}</p>`;
        const paginationTop = document.getElementById('pagination-top');
        const paginationBottom = document.getElementById('pagination-bottom');
        const paginationHTML = buildPaginationControls();
        paginationTop.innerHTML = paginationHTML;
        paginationBottom.innerHTML = paginationHTML;
        contentDetailsDiv.innerHTML = tableHtml;
        document.querySelectorAll('.clickable-delete').forEach(element => {
            element.addEventListener('click', function() {
                let targetService = this.getAttribute('data-service');
                let targetIdentifier = this.getAttribute('data-identifier');
                deleteContent(targetService, targetIdentifier);
            });
        });
        document.querySelectorAll('.clickable-edit').forEach(element => {
            element.addEventListener('click', function() {
                let targetService = this.getAttribute('data-service');
                let targetIdentifier = this.getAttribute('data-identifier');
                editContent(targetService, targetIdentifier);
            });
        });
        document.querySelectorAll('.clickable-metadata').forEach(element => {
            element.addEventListener('click', function() {
                let metadataIndex = this.getAttribute('data-metadata-index');
                if (metadataIndex >= 0) {
                    let metadata = metadataArray[metadataIndex];
                    openMetadataDialog(metadata);
                } else {
                    alert('No metadata available.');
                }
            });
        });
        addPaginationEventHandlers();
    } else {
        contentDetailsDiv.innerHTML = '<p>No results found.</p>';
        contentSummaryDiv.innerHTML = '';
        document.getElementById('pagination-top').innerHTML = '';
        document.getElementById('pagination-bottom').innerHTML = '';
    }
}

function buildPaginationControls() {
    const totalPages = Math.ceil(totalResults / itemsPerPage);
    if (totalPages <= 1) {
        return ''; // No need if only one page
    }
    let html = '';
    // First and previous arrows
    if (currentPage > 1) {
        html += `<span class="pagination-link" data-page="1">««</span>`;
        html += `<span class="pagination-link" data-page="${currentPage - 1}">«</span>`;
    } else {
        html += `<span style="color:gray;">««</span>`;
        html += `<span style="color:gray;">«</span>`;
    }
    for (let p = 1; p <= totalPages; p++) {
        if (p === currentPage) {
            html += `<span class="current-page">${p}</span>`;
        } else {
            html += `<span class="pagination-link" data-page="${p}">${p}</span>`;
        }
    }
    if (currentPage < totalPages) {
        html += `<span class="pagination-link" data-page="${currentPage + 1}">»</span>`;
        html += `<span class="pagination-link" data-page="${totalPages}">»»</span>`;
    } else {
        html += `<span style="color:gray;">»</span>`;
        html += `<span style="color:gray;">»»</span>`;
    }
    return html;
}

function addPaginationEventHandlers() {
    document.querySelectorAll('.pagination-link').forEach(link => {
        link.addEventListener('click', function() {
            const newPage = parseInt(this.getAttribute('data-page'), 10);
            if (!isNaN(newPage)) {
                currentPage = newPage;
                fetchPage();
            }
        });
    });
}

function formatSize(size) {
    if (size > (1024*1024*1024*1024)) {
        return (size / (1024*1024*1024*1024)).toFixed(2) + ' TB';
    } else if (size > (1024*1024*1024)) {
        return (size / (1024*1024*1024)).toFixed(2) + ' GB';
    } else if (size > (1024*1024)) {
        return (size / (1024*1024)).toFixed(2) + ' MB';
    } else if (size > 1024) {
        return (size / 1024).toFixed(2) + ' KB';
    } else {
        return size + ' B';
    }
}

function generatePreviewHTML(result, userName, identifier) {
    const service = result.service;
    const previewBaseURL = `/arbitrary/${service}/${userName}/${identifier}`;
    const editIconHTML = `<img src="file-up.png" style="width:40px;height:40px;"
            class="clickable-edit" data-service="${service}" data-identifier="${identifier}">`;
    if ((service === 'THUMBNAIL') || (service === 'QCHAT_IMAGE') || (service === 'IMAGE')) {
        return `${editIconHTML}
        <img src="${previewBaseURL}" style="width:100px;height:100px;"
        onerror="this.style='display:none'"></img>`;
    } else if (service === 'VIDEO') {
        return `${editIconHTML}
        <video controls width="400">
            <source src="${previewBaseURL}">
        </video>`;
    } else if ((service === 'AUDIO') || (service === 'QCHAT_AUDIO') || (service === 'VOICE')) {
        return `${editIconHTML}
        <audio controls>
            <source src="${previewBaseURL}">
        </audio>`;
    } else if ((service === 'BLOG') || (service === 'BLOG_POST') || (service === 'BLOG_COMMENT') || (service === 'DOCUMENT') || (service === 'GAME')) {
        return `${editIconHTML}
        <embed width="100%" type="text/html" src="${previewBaseURL}"></embed>`;
    } else {
        // Default preview
        return `<embed width="100%" type="text/html" src="${previewBaseURL}"></embed>`;
    }
}

async function deleteContent(service, identifier) {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }
        showPublishModal("Please wait...");
        // Fetch existing metadata
        let existingMetadata = {};
        try {
            const metadataResponse = await fetch(`/arbitrary/resources/search?name=${userName}&service=${service}&identifier=${identifier}&includemetadata=true&exactmatchnames=true&mode=ALL`);
            if (metadataResponse.ok) {
                const metadataResults = await metadataResponse.json();
                if (metadataResults.length > 0 && metadataResults[0].metadata) {
                    existingMetadata = metadataResults[0].metadata;
                }
            }
        } catch (err) {
            console.error('Error fetching existing metadata:', err);
        }
        const emptyFile = new Blob([], { type: 'application/octet-stream' });
        const deleteIdent = (identifier === 'default') ? '' : identifier;
        // Prepare the publish parameters, including existing metadata if available
        const publishParams = {
            action: "PUBLISH_QDN_RESOURCE",
            name: userName,
            service: service,
            identifier: deleteIdent,
            file: emptyFile
        };
        // List of metadata fields to delete
        const metadataFields = ['filename', 'title', 'description'];
        // Add existing metadata fields to publishParams if they exist
        for (const field of metadataFields) {
            if (existingMetadata[field]) {
                publishParams[field] = "deleted";
            }
        }
        if (existingMetadata["category"]) {
            publishParams["category"] = "UNCATEGORIZED";
        }
        if (existingMetadata["tags"]) {
            publishParams["tag1"] = "deleted";
        }
        // Proceed with publishing using publishWithFeedback
        try {
            const response = await publishWithFeedback(publishParams);
            console.log('Content deleted successfully');
        } catch (error) {
            console.error('Error deleting content:', error);
        }
    } catch (error) {
        console.error('Error deleting content:', error);
    }
}

async function editContent(service, identifier) {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }
        showPublishModal("Please wait...");
        // Fetch existing metadata
        let existingMetadata = {};
        try {
            const metadataResponse = await fetch(`/arbitrary/resources/search?name=${userName}&service=${service}&identifier=${identifier}&includemetadata=true&exactmatchnames=true&mode=ALL`);
            if (metadataResponse.ok) {
                const metadataResults = await metadataResponse.json();
                if (metadataResults.length > 0 && metadataResults[0].metadata) {
                    existingMetadata = metadataResults[0].metadata;
                }
            }
        } catch (err) {
            console.error('Error fetching existing metadata:', err);
        }
        const editIdent = (identifier === 'default') ? '' : identifier;
        // Prepare the publish parameters
        const publishParams = {
            action: "PUBLISH_QDN_RESOURCE",
            name: userName,
            service: service,
            identifier: editIdent,
            // 'file' will be added below after obtaining the edited or selected file
        };
        const textServices = ['BLOG', 'BLOG_POST', 'BLOG_COMMENT', 'DOCUMENT'];
        if (textServices.includes(service)) {
            // For text types, fetch the current content
            let contentUrl = `/arbitrary/${service}/${userName}/${identifier}`;
            let content = '';
            try {
                const contentResponse = await fetch(contentUrl);
                if (contentResponse.ok) {
                    content = await contentResponse.text();
                } else {
                    content = 'Error fetching content';
                }
            } catch (err) {
                content = 'Error fetching content';
            }
            // Open a modal dialog to edit the content
            let editedContent = await openTextEditorDialog(content);
            if (editedContent === null) {
                // User cancelled
                return;
            }
            // Create a new Blob with the edited content
            const editedFile = new Blob([editedContent], { type: 'text/plain' });
            publishParams.file = editedFile; // Add the edited file to publishParams
        } else {
            closePublishModal();
            // For other types, prompt the user to select a new file
            const input = document.createElement('input');
            input.type = 'file';
            input.click();
            const selectedFilePromise = new Promise((resolve, reject) => {
                input.onchange = (event) => {
                    const file = event.target.files[0];
                    resolve(file);
                };
                input.onerror = reject;
            });
            const selectedFile = await selectedFilePromise;
            publishParams.file = selectedFile; // Add the selected file to publishParams
        }
        // Open metadata editor dialog
        let updatedMetadata = await openMetadataEditorDialog(existingMetadata);
        if (updatedMetadata === null) {
            // User cancelled
            return;
        }
        // Update 'publishParams' with 'updatedMetadata'
        const metadataFields = ['filename', 'title', 'description', 'category'];
        for (const field of metadataFields) {
            if (updatedMetadata[field]) {
                publishParams[field] = updatedMetadata[field];
            } else {
                delete publishParams[field];
            }
        }
        // Handle tags
        if (updatedMetadata['tags']) {
            const tagsArray = updatedMetadata['tags'].split(',').map(tag => tag.trim()).filter(tag => tag);
            for (let i = 1; i <= 5; i++) {
                if (tagsArray[i - 1]) {
                    publishParams[`tag${i}`] = tagsArray[i - 1];
                } else {
                    delete publishParams[`tag${i}`];
                }
            }
        } else {
            // Remove tags if none provided
            for (let i = 1; i <= 5; i++) {
                delete publishParams[`tag${i}`];
            }
        }
        // Proceed with publishing using publishWithFeedback
        try {
            const response = await publishWithFeedback(publishParams);
            console.log('Content edited successfully');
            // Optionally, refresh the content display
            // fetchContent();
        } catch (error) {
            console.error('Error editing content:', error);
        }
    } catch (error) {
        console.error('Error editing content:', error);
    }
}

function openTextEditorDialog(content) {
    return new Promise((resolve, reject) => {
        // Create the modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100%';
        modalOverlay.style.height = '100%';
        modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.zIndex = '1000';

        // Create the modal content container
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = '#2d3749'; // Use background color from main content
        modalContent.style.color = '#c9d2d9'; // Use text color from your CSS
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '25px'; // Match border radius from your CSS
        modalContent.style.maxWidth = '600px';
        modalContent.style.width = '90%';
        modalContent.style.fontFamily = "'Lexend', sans-serif"; // Use the same font
        modalContent.style.lineHeight = '1.6'; // Consistent line height

        // Create the textarea for editing
        const textarea = document.createElement('textarea');
        textarea.style.width = '100%';
        textarea.style.height = '300px';
        textarea.style.backgroundColor = '#3d4452'; // Use background color from main content
        textarea.style.color = '#c9d2d9'; // Use text color from your CSS
        textarea.value = content;

        // Create the button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.textAlign = 'right';
        buttonContainer.style.marginTop = '10px';

        // Create the Save and Cancel buttons
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.marginRight = '10px';

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);

        modalContent.appendChild(textarea);
        modalContent.appendChild(buttonContainer);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // Event listeners for the buttons
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            closePublishModal();
            resolve(null);
        });

        saveButton.addEventListener('click', () => {
            const editedContent = textarea.value;
            document.body.removeChild(modalOverlay);
            resolve(editedContent);
        });
    });
}

function openMetadataDialog(metadata) {
    // Create the modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100%';
    modalOverlay.style.height = '100%';
    modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '1000';

    // Create the modal content container
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = '#2d3749'; // Use background color from main content
    modalContent.style.color = '#c9d2d9'; // Use text color from your CSS
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '25px'; // Match border radius from your CSS
    modalContent.style.maxWidth = '600px';
    modalContent.style.width = '90%';
    modalContent.style.fontFamily = "'Lexend', sans-serif"; // Use the same font
    modalContent.style.lineHeight = '1.6'; // Consistent line height

    // Create the content display
    const contentDiv = document.createElement('div');
    contentDiv.style.maxHeight = '400px';
    contentDiv.style.overflowY = 'auto';

    // Build the metadata display
    for (let key in metadata) {
        const keyElement = document.createElement('strong');
        keyElement.textContent = key + ': ';
        keyElement.style.color = '#ffffff'; // Make keys stand out
        const valueElement = document.createElement('span');
        valueElement.textContent = metadata[key];
        const lineBreak = document.createElement('br');
        contentDiv.appendChild(keyElement);
        contentDiv.appendChild(valueElement);
        contentDiv.appendChild(lineBreak);
    }

    // Create the Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.marginTop = '10px';

    modalContent.appendChild(contentDiv);
    modalContent.appendChild(closeButton);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Event listener for the Close button
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
}

function openMetadataEditorDialog(existingMetadata) {
    return new Promise((resolve, reject) => {
        // Create the modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100%';
        modalOverlay.style.height = '100%';
        modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.zIndex = '1000';

        // Create the modal content container
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = '#2d3749';
        modalContent.style.color = '#c9d2d9';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '25px';
        modalContent.style.maxWidth = '600px';
        modalContent.style.width = '90%';
        modalContent.style.fontFamily = "'Lexend', sans-serif";
        modalContent.style.lineHeight = '1.6';

        // Create the form
        const form = document.createElement('form');

        const fields = ['filename', 'title', 'description', 'category', 'tags'];

        // Define the categories
        const categories = [
            { value: '', display: '' },
            { value: 'ART', display: 'Art and Design' },
            { value: 'AUTOMOTIVE', display: 'Automotive' },
            { value: 'BEAUTY', display: 'Beauty' },
            { value: 'BOOKS', display: 'Books and Reference' },
            { value: 'BUSINESS', display: 'Business' },
            { value: 'COMMUNICATIONS', display: 'Communications' },
            { value: 'CRYPTOCURRENCY', display: 'Cryptocurrency and Blockchain' },
            { value: 'CULTURE', display: 'Culture' },
            { value: 'DATING', display: 'Dating' },
            { value: 'DESIGN', display: 'Design' },
            { value: 'ENTERTAINMENT', display: 'Entertainment' },
            { value: 'EVENTS', display: 'Events' },
            { value: 'FAITH', display: 'Faith and Religion' },
            { value: 'FASHION', display: 'Fashion' },
            { value: 'FINANCE', display: 'Finance' },
            { value: 'FOOD', display: 'Food and Drink' },
            { value: 'GAMING', display: 'Gaming' },
            { value: 'GEOGRAPHY', display: 'Geography' },
            { value: 'HEALTH', display: 'Health' },
            { value: 'HISTORY', display: 'History' },
            { value: 'HOME', display: 'Home' },
            { value: 'KNOWLEDGE', display: 'Knowledge Share' },
            { value: 'LANGUAGE', display: 'Language' },
            { value: 'LIFESTYLE', display: 'Lifestyle' },
            { value: 'MANUFACTURING', display: 'Manufacturing' },
            { value: 'MAPS', display: 'Maps and Navigation' },
            { value: 'MUSIC', display: 'Music' },
            { value: 'NEWS', display: 'News' },
            { value: 'OTHER', display: 'Other' },
            { value: 'PETS', display: 'Pets' },
            { value: 'PHILOSOPHY', display: 'Philosophy' },
            { value: 'PHOTOGRAPHY', display: 'Photography' },
            { value: 'POLITICS', display: 'Politics' },
            { value: 'PRODUCE', display: 'Products and Services' },
            { value: 'PRODUCTIVITY', display: 'Productivity' },
            { value: 'PSYCHOLOGY', display: 'Psychology' },
            { value: 'QORTAL', display: 'Qortal' },
            { value: 'SCIENCE', display: 'Science' },
            { value: 'SELF_CARE', display: 'Self Care' },
            { value: 'SELF_SUFFICIENCY', display: 'Self-Sufficiency and Homesteading' },
            { value: 'SHOPPING', display: 'Shopping' },
            { value: 'SOCIAL', display: 'Social' },
            { value: 'SOFTWARE', display: 'Software' },
            { value: 'SPIRITUALITY', display: 'Spirituality' },
            { value: 'SPORTS', display: 'Sports' },
            { value: 'STORYTELLING', display: 'Storytelling' },
            { value: 'TECHNOLOGY', display: 'Technology' },
            { value: 'TOOLS', display: 'Tools' },
            { value: 'TRAVEL', display: 'Travel' },
            { value: 'UNCATEGORIZED', display: 'Uncategorized' },
            { value: 'VIDEO', display: 'Video' },
            { value: 'WEATHER', display: 'Weather' },
        ];

        fields.forEach(field => {
            const label = document.createElement('label');
            label.textContent = field.charAt(0).toUpperCase() + field.slice(1) + ':';
            label.style.display = 'block';
            label.style.marginTop = '10px';

            let input;

            if (field === 'category') {
                // Create a select element for category
                input = document.createElement('select');
                input.name = field;
                input.style.width = '100%';
                input.style.padding = '5px';
                input.style.marginTop = '5px';

                // Add options to the select element
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.value;
                    option.textContent = category.display;
                    input.appendChild(option);
                });

                // Set the selected value if it exists in existingMetadata
                if (existingMetadata[field]) {
                    input.value = existingMetadata[field];
                } else {
                    input.value = ''; // Default to blank line
                }
            } else {
                // Create an input element for other fields
                input = document.createElement('input');
                input.type = 'text';
                input.name = field;
                input.style.width = '100%';
                input.style.padding = '5px';
                input.style.marginTop = '5px';

                if (existingMetadata[field]) {
                    if (field === 'tags' && Array.isArray(existingMetadata[field])) {
                        input.value = existingMetadata[field].join(', ');
                    } else {
                        input.value = existingMetadata[field];
                    }
                } else {
                    input.placeholder = field.charAt(0).toUpperCase() + field.slice(1);
                }
            }

            label.appendChild(input);
            form.appendChild(label);
        });

        // Create the button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.textAlign = 'right';
        buttonContainer.style.marginTop = '20px';

        // Create the Save and Cancel buttons
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.type = 'submit';
        saveButton.style.marginLeft = '10px';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.type = 'button';

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        form.appendChild(buttonContainer);

        modalContent.appendChild(form);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // Event listeners
        cancelButton.addEventListener('click', (event) => {
            event.preventDefault();
            document.body.removeChild(modalOverlay);
            closePublishModal();
            resolve(null);
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            // Collect the metadata
            const formData = new FormData(form);
            const updatedMetadata = {};
            fields.forEach(field => {
                const value = formData.get(field);
                if (value) {
                    updatedMetadata[field] = value;
                }
            });
            document.body.removeChild(modalOverlay);
            resolve(updatedMetadata);
        });
    });
}

let publishModal = null;

function showPublishModal(message) {
    if (!publishModal) {
        // Create the modal
        publishModal = document.createElement('div');
        publishModal.style.position = 'fixed';
        publishModal.style.top = '0';
        publishModal.style.left = '0';
        publishModal.style.width = '100%';
        publishModal.style.height = '100%';
        publishModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        publishModal.style.display = 'flex';
        publishModal.style.justifyContent = 'center';
        publishModal.style.alignItems = 'center';
        publishModal.style.zIndex = '1000';

        // Create the modal content container
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = '#2d3749'; // Use background color from main content
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '5px';
        modalContent.style.maxWidth = '400px';
        modalContent.style.width = '90%';
        modalContent.style.textAlign = 'center';

        // Create the message element
        const messageElement = document.createElement('p');
        messageElement.id = 'publish-modal-message';
        messageElement.textContent = message;

        modalContent.appendChild(messageElement);
        publishModal.appendChild(modalContent);
        document.body.appendChild(publishModal);
    } else {
        // Update the message
        const messageElement = publishModal.querySelector('#publish-modal-message');
        messageElement.textContent = message;

        // Remove any buttons (Retry/Cancel) if they exist
        const buttons = publishModal.querySelector('#publish-modal-buttons');
        if (buttons) {
            buttons.remove();
        }
    }
    if (message == "Publish TX submitted! Confirmation needed.") {
        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.id = 'publish-modal-buttons';
        buttonsContainer.style.marginTop = '20px';
        // Create Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            closePublishModal();
        });
        buttonsContainer.appendChild(closeButton);
        // Append button to modal content
        const modalContent = publishModal.firstChild;
        modalContent.appendChild(buttonsContainer);
    }
}

function closePublishModal() {
    if (publishModal) {
        document.body.removeChild(publishModal);
        publishModal = null;
    }
}

function showPublishErrorModal(errorMessage, onRetry, onCancel) {
    if (publishModal) {
        // Update the message
        const messageElement = publishModal.querySelector('#publish-modal-message');
        messageElement.textContent = errorMessage;

        // Remove any existing buttons
        const existingButtons = publishModal.querySelector('#publish-modal-buttons');
        if (existingButtons) {
            existingButtons.remove();
        }

        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.id = 'publish-modal-buttons';
        buttonsContainer.style.marginTop = '20px';

        // Create Retry button
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry';
        retryButton.style.marginRight = '10px';
        retryButton.addEventListener('click', () => {
            onRetry();
        });

        // Create Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            onCancel();
        });

        buttonsContainer.appendChild(retryButton);
        buttonsContainer.appendChild(cancelButton);

        // Append buttons to modal content
        const modalContent = publishModal.firstChild;
        modalContent.appendChild(buttonsContainer);
    }
}

async function publishWithFeedback(publishParams) {
    return new Promise(async (resolve, reject) => {
        async function attemptPublish() {
            try {
                // Show modal with "Attempting to publish, please wait..."
                showPublishModal("Attempting to publish, please wait...");
                const response = await qortalRequest(publishParams);
                // Close modal
                resolve(response);
                showPublishModal("Publish TX submitted! Confirmation needed.");
            } catch (error) {
                // Update modal to show error message and Retry/Cancel buttons
                showPublishErrorModal(`Publishing failed: ${error.message}`, () => {
                    // On Retry
                    attemptPublish();
                }, () => {
                    // On Cancel
                    closePublishModal();
                    reject(error);
                });
            }
        }
        await attemptPublish();
    });
}

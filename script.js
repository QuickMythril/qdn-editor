let userPublicKey = '';
let userAddress = '';
let userName = '';
let allResults = [];
let metadataArray = [];
const infoDetails =
    `<img src="red-x.svg" style="width:15px;height:15px;">
    Click the identifier to "delete" content.<br>
    (This will replace it with a blank file.)<br>
    <br>
    <img src="file-up.png" style="width:15px;height:15px;">
    Click the file select icon to "edit" content.<br>
    (This will replace it with a selected file.)`;

document.getElementById('login-button').addEventListener('click', accountLogin);

async function accountLogin() {
    try {
        const account = await qortalRequest({
            action: "GET_USER_ACCOUNT"
        });
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
        fetchContent();
    } catch (error) {
        console.error('Error fetching account details:', error);
        document.getElementById('account-details').innerHTML = `Error fetching account details: ${error}`;
    }
}

async function fetchContent() {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }
        document.getElementById('content-details').innerHTML = '<p>Loading...</p>';

        const response = await fetch(`/arbitrary/resources/search?name=${userName}&includemetadata=true&exactmatchnames=true&mode=ALL`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        allResults = await response.json();
        if (allResults.length > 0) {
            // Collect unique service types
            const serviceTypesSet = new Set();
            for (const result of allResults) {
                serviceTypesSet.add(result.service);
            }
            const serviceTypes = Array.from(serviceTypesSet);
            // Generate checkboxes
            const filterOptionsDiv = document.getElementById('filter-options');
            filterOptionsDiv.innerHTML = ''; // Clear any existing content
            serviceTypes.forEach(serviceType => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `filter-${serviceType}`;
                checkbox.name = 'serviceType';
                checkbox.value = serviceType;
                // By default, none of the checkboxes are checked
                // Add event listener
                checkbox.addEventListener('change', function() {
                    updateContentDisplay();
                });
                const label = document.createElement('label');
                label.htmlFor = `filter-${serviceType}`;
                label.appendChild(document.createTextNode(serviceType));
                filterOptionsDiv.appendChild(checkbox);
                filterOptionsDiv.appendChild(label);
                // filterOptionsDiv.appendChild(document.createElement('br'));
            });
            // Initial display of content
            updateContentDisplay();
        } else {
            document.getElementById('content-details').innerHTML = '<p>No results found.</p>';
            document.getElementById('content-summary').innerHTML = '';
        }
    } catch (error) {
        console.error('Error fetching content:', error);
        document.getElementById('content-details').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

function updateContentDisplay() {
    // Get all checkboxes
    const checkboxes = document.querySelectorAll('input[name="serviceType"]');
    // Get selected service types
    let selectedServiceTypes = [];
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedServiceTypes.push(checkbox.value);
        }
    });
    // Determine if we should display all results
    let displayAll = (selectedServiceTypes.length === 0) || (selectedServiceTypes.length === checkboxes.length);
    // Filter the results
    let filteredResults = [];
    if (displayAll) {
        filteredResults = allResults;
    } else {
        filteredResults = allResults.filter(result => selectedServiceTypes.includes(result.service));
    }
    // Build the table with filtered results
    buildContentTable(filteredResults);
}

function buildContentTable(results) {
    if (results.length > 0) {
        let tableHtml = '<table>';
        let totalFiles = 0;
        let totalSize = 0;
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
        results.sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
        metadataArray = []; // Reset metadataArray
        for (const result of results) {
            totalFiles += 1;
            totalSize += result.size;
            let identifier = (result.identifier === undefined) ? 'default' : result.identifier;
            let createdString = new Date(result.created).toLocaleString()
            let updatedString = new Date(result.updated).toLocaleString()
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
            } else {
                metadataKeys = '';
            }
            tableHtml += `<tr>
                <td>${result.service}</td>
                <td><span class="clickable-delete" data-service="${result.service}" data-identifier="${identifier}">
                <img src="red-x.svg" style="width:15px;height:15px;">${identifier}</span></td>
                <td><span class="clickable-metadata" data-metadata-index='${metadataIndex}'>${metadataKeys}</span></td>
                <td>`;
            if ((result.service === 'THUMBNAIL') ||
                (result.service === 'QCHAT_IMAGE') ||
                (result.service === 'IMAGE')) {
                tableHtml += `<img src="file-up.png" style="width:40px;height:40px;"
                class="clickable-edit" data-service="${result.service}" data-identifier="${identifier}">
                <img src="/arbitrary/${result.service}/${userName}/${identifier}"
                style="width:100px;height:100px;"
                onerror="this.style='display:none'"
                ></img>`;
            } else if (result.service === 'VIDEO') {
                tableHtml += `<img src="file-up.png" style="width:40px;height:40px;"
                class="clickable-edit" data-service="${result.service}" data-identifier="${identifier}">
                <video controls width="400">
                <source src="/arbitrary/${result.service}/${userName}/${identifier}">
                </source></video>`;
            } else if ((result.service === 'AUDIO') ||
                (result.service === 'QCHAT_AUDIO') ||
                (result.service === 'VOICE')) {
                tableHtml += `<img src="file-up.png" style="width:40px;height:40px;"
                class="clickable-edit" data-service="${result.service}" data-identifier="${identifier}">
                <audio controls>
                <source src="/arbitrary/${result.service}/${userName}/${identifier}">
                </source></audio>`;
            } else if ((result.service === 'BLOG') ||
                (result.service === 'BLOG_POST') ||
                (result.service === 'BLOG_COMMENT') ||
                (result.service === 'DOCUMENT')) {
                tableHtml += `<img src="file-up.png" style="width:40px;height:40px;"
                class="clickable-edit" data-service="${result.service}" data-identifier="${identifier}">
                <embed width="100%" type="text/html"
                src="/arbitrary/${result.service}/${userName}/${identifier}">
                </embed>`;
            } else {
                tableHtml += `<embed width="100%" type="text/html"
                src="/arbitrary/${result.service}/${userName}/${identifier}">
                </embed>`;
            }
            tableHtml += `</td>
                <td>${sizeString}</td>
                <td>${createdString}<br>${updatedString}</td>
            </tr>`;
        }
        tableHtml += `</table>`;
        document.getElementById('content-details').innerHTML = tableHtml;
        document.getElementById('content-summary').innerHTML = `<p>Total Files: ${totalFiles}</p>
        <p>Total Size: ${formatSize(totalSize)}</p>`;
        // Add event listeners
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
    } else {
        document.getElementById('content-details').innerHTML = '<p>No results found.</p>';
        document.getElementById('content-summary').innerHTML = '';
    }
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

async function deleteContent(service, identifier) {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }
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
        const response = await qortalRequest(publishParams);
        console.log('Content deleted successfully');
    } catch (error) {
        console.error('Error deleting content:', error);
    }
}

async function editContent(service, identifier) {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }
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
        // Proceed with publishing
        const response = await qortalRequest(publishParams);
        console.log('Content edited successfully');
        // Optionally, refresh the content display
        // fetchContent();
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
        modalContent.style.backgroundColor = '#fff';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '5px';
        modalContent.style.maxWidth = '600px';
        modalContent.style.width = '90%';

        // Create the textarea for editing
        const textarea = document.createElement('textarea');
        textarea.style.width = '100%';
        textarea.style.height = '300px';
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

        fields.forEach(field => {
            const label = document.createElement('label');
            label.textContent = field.charAt(0).toUpperCase() + field.slice(1) + ':';
            label.style.display = 'block';
            label.style.marginTop = '10px';

            const input = document.createElement('input');
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

let userPublicKey = '';
let userAddress = '';
let userName = '';

document.getElementById('login-button').addEventListener('click', accountLogin);

async function accountLogin() {
    try {
        const account = await qortalRequest({
            action: "GET_USER_ACCOUNT"
        });
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
        document.getElementById('info-details').innerHTML = 'Select an item to "delete" it.';
        document.getElementById('account-details').innerHTML = `${userAddress}<br>${userName}`;
        fetchContent();
    } catch (error) {
        console.error('Error fetching account details:', error);
        // Handle error gracefully, e.g., show an error message to the user
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

        const results = await response.json();
        if (results.length > 0) {
            let tableHtml = '<table>';
            tableHtml += `
                <tr>
                    <th>Service</th>
                    <th>Identifier</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th>Last Updated</th>
                </tr>
            `;
            results.sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
            results.forEach(result => {
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
                tableHtml += `<tr><td>${result.service}</td>
                    <td class="clickable-name" data-service="${result.service}" data-identifier="${identifier}">`;
                if ((result.service === 'THUMBNAIL') ||
                (result.service === 'QCHAT_IMAGE') ||
                (result.service === 'IMAGE')) {
                    tableHtml += `<img src="/arbitrary/${result.service}/${userName}/${identifier}"
                    style="width:100px;height:100px;"
                    onerror="this.style='display:none'"
                    ></img> ${identifier}`
                } else {
                    tableHtml += `${identifier}<br>
                    <embed type="text/html" src="/arbitrary/${result.service}/${userName}/${identifier}">
                    </embed>`
                }
                tableHtml += `</td>
                    <td>${sizeString}</td>
                    <td>${createdString}</td>
                    <td>${updatedString}</td>
                </tr>`;
            });
            tableHtml += '</table>';
            document.getElementById('content-details').innerHTML = tableHtml;
            document.querySelectorAll('.clickable-name').forEach(element => {
                element.addEventListener('click', function() {
                    let targetService = this.getAttribute('data-service');
                    let targetIdentifier = this.getAttribute('data-identifier');
                    deleteContent(targetService, targetIdentifier);
                });
            });
        } else {
            document.getElementById('content-details').innerHTML = '<p>No results found.</p>';
        }
    } catch (error) {
        console.error('Error fetching content:', error);
        document.getElementById('content-details').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

function formatSize(size) {
    if (size > (1024*1024)) {
        return (size / (1024*1024)).toFixed(2) + ' mb';
    } else if (size > 1024) {
        return (size / 1024).toFixed(2) + ' kb';
    } else {
        return size + ' b';
    }
}

async function deleteContent(service, identifier) {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }

        const emptyFile = new Blob([], { type: 'application/octet-stream' });
        const deleteIdent = (identifier === 'default') ? '' : identifier;
        const response = await qortalRequest({
            action: "PUBLISH_QDN_RESOURCE",
            name: userName,
            service: service,
            identifier: deleteIdent,
            file: emptyFile
        });
        console.log('Content deleted successfully');
    } catch (error) {
        console.error('Error deleting content:', error);
    }
}

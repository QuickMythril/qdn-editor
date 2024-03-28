let userPublicKey = '';
let userAddress = '';
let userName = '';
const infoDetails =
    `<img src="red-x.svg" style="width:15px;height:15px;">
    Click the identifier to "delete" content.<br>
    (This will replace it with a blank file.)<br>
    <br>
    <img src="file-up.png" style="width:15px;height:15px;">
    Click the file select icon to "edit" content.<br>
    (This will replace it with a selected file.)`

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

        const results = await response.json();
        if (results.length > 0) {
            let tableHtml = '<table>';
            let totalFiles = 0;
            let totalSize = 0;
            tableHtml += `
                <tr>
                    <th>Service</th>
                    <th>Identifier</th>
                    <th>Preview</th>
                    <th>Size</th>
                    <th>Created / Updated</th>
                </tr>
            `;
            results.sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
            results.forEach(result => {
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
                tableHtml += `<tr><td>${result.service}</td>
                    <td><span class="clickable-delete" data-service="${result.service}" data-identifier="${identifier}">
                    <img src="red-x.svg" style="width:15px;height:15px;">${identifier}</span></td><td`;
                if ((result.service === 'THUMBNAIL') ||
                (result.service === 'QCHAT_IMAGE') ||
                (result.service === 'IMAGE')) {
                    tableHtml += `><img src="file-up.png" style="width:40px;height:40px;"
                    class="clickable-edit" data-service="${result.service}" data-identifier="${identifier}">
                    <img src="/arbitrary/${result.service}/${userName}/${identifier}"
                    style="width:100px;height:100px;"
                    onerror="this.style='display:none'"
                    ></img>`
                } else if (result.service === 'VIDEO') {
                    tableHtml += `><img src="file-up.png" style="width:40px;height:40px;"
                    class="clickable-edit" data-service="${result.service}" data-identifier="${identifier}">
                    <video controls>
                    <source src="/arbitrary/${result.service}/${userName}/${identifier}">
                    </source></video>`
                } else if ((result.service === 'AUDIO') ||
                (result.service === 'QCHAT_AUDIO') ||
                (result.service === 'VOICE')) {
                    tableHtml += `><img src="file-up.png" style="width:40px;height:40px;"
                    class="clickable-edit" data-service="${result.service}" data-identifier="${identifier}">
                    <audio controls>
                    <source src="/arbitrary/${result.service}/${userName}/${identifier}">
                    </source></audio>`
                } else if ((result.service === 'BLOG') ||
                (result.service === 'BLOG_POST') ||
                (result.service === 'BLOG_COMMENT')) {
                    tableHtml += `><embed width="100%" type="text/html"
                    src="/arbitrary/${result.service}/${userName}/${identifier}">
                    </embed>`
                } else {
                    tableHtml += `><embed width="100%" type="text/html"
                    src="/arbitrary/${result.service}/${userName}/${identifier}">
                    </embed>`
                }
                tableHtml += `</td>
                    <td>${sizeString}</td>
                    <td>${createdString}<br>${updatedString}</td>
                </tr>`;
            });
            let totalSizeString = formatSize(totalSize);
            tableHtml += `</table>`;
            document.getElementById('content-details').innerHTML = tableHtml;
            document.getElementById('account-details').innerHTML += `<p>Total Files: ${totalFiles}</p>
            <p>Total Size: ${totalSizeString}</p>`;
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
        } else {
            document.getElementById('content-details').innerHTML = '<p>No results found.</p>';
        }
    } catch (error) {
        console.error('Error fetching content:', error);
        document.getElementById('content-details').innerHTML = `<p>Error: ${error.message}</p>`;
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

async function editContent(service, identifier) {
    try {
        if (!userName || userName === 'Name unavailable') {
            return;
        }

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
        const editIdent = (identifier === 'default') ? '' : identifier;
        const response = await qortalRequest({
            action: "PUBLISH_QDN_RESOURCE",
            name: userName,
            service: service,
            identifier: editIdent,
            file: selectedFile
        });
        console.log('Content edited successfully');
    } catch (error) {
        console.error('Error edited content:', error);
    }
}

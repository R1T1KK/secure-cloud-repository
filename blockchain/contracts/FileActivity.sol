// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FileActivity {
    struct Activity {
        string filename;
        string fileHash;
        string action; // "UPLOAD" or "DOWNLOAD"
        uint256 timestamp;
        address performer;
    }

    Activity[] public activities;

    event ActivityLogged(
        string filename,
        string fileHash,
        string action,
        uint256 timestamp,
        address performer
    );

    function recordActivity(
        string memory _filename,
        string memory _fileHash,
        string memory _action
    ) public returns (uint256) {
        activities.push(
            Activity({
                filename: _filename,
                fileHash: _fileHash,
                action: _action,
                timestamp: block.timestamp,
                performer: msg.sender
            })
        );

        emit ActivityLogged(
            _filename,
            _fileHash,
            _action,
            block.timestamp,
            msg.sender
        );

        return activities.length - 1;
    }

    function getActivitiesCount() external view returns (uint256) {
        return activities.length;
    }

    function getAllActivities() external view returns (Activity[] memory) {
        return activities;
    }
}

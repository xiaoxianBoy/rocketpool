pragma solidity 0.6.8;

// SPDX-License-Identifier: GPL-3.0-only

import "../../types/MinipoolDeposit.sol";

interface RocketMinipoolManagerInterface {
    function getMinipoolCount() external view returns (uint256);
    function getMinipoolAt(uint256 _index) external view returns (address);
    function getNodeMinipoolCount(address _nodeAddress) external view returns (uint256);
    function getNodeMinipoolAt(address _nodeAddress, uint256 _index) external view returns (address);
    function getMinipoolByPubkey(bytes calldata _pubkey) external view returns (address);
    function getMinipoolExists(address _minipoolAddress) external view returns (bool);
    function getMinipoolPubkey(address _minipoolAddress) external view returns (bytes memory);
    function getMinipoolTotalWithdrawalBalance(address _minipoolAddress) external view returns (uint256);
    function getMinipoolNodeWithdrawalBalance(address _minipoolAddress) external view returns (uint256);
    function createMinipool(address _nodeAddress, MinipoolDeposit _depositType) external returns (address);
    function destroyMinipool() external;
    function setMinipoolPubkey(bytes calldata _pubkey) external;
    function setMinipoolWithdrawalBalances(address _minipoolAddress, uint256 _total, uint256 _node) external;
}

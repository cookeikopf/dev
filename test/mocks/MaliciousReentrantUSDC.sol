// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IReenterTarget {
    function settleTask(uint256 taskId, uint256 amount) external;
}

contract MaliciousReentrantUSDC is ERC20 {
    address public target;
    uint256 public taskId;
    bool public reenterOnTransferFrom;

    constructor() ERC20("Malicious USDC", "mUSDCX") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function configureReentry(address _target, uint256 _taskId, bool enabled) external {
        target = _target;
        taskId = _taskId;
        reenterOnTransferFrom = enabled;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        bool ok = super.transferFrom(from, to, amount);
        if (ok && reenterOnTransferFrom && target != address(0)) {
            reenterOnTransferFrom = false;
            IReenterTarget(target).settleTask(taskId, 0);
        }
        return ok;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IClawFlashBorrower} from "../../src/interfaces/IClawFlashBorrower.sol";

/// @title MockFlashBorrower
/// @notice Test borrower for flash loan callback.
contract MockFlashBorrower is IClawFlashBorrower {
    uint256 public constant SUCCESS =
        uint256(keccak256("ClawCreditFlashBorrower.onFlashLoan"));

    bool public repayLoan = true;

    function setRepayLoan(bool shouldRepay) external {
        repayLoan = shouldRepay;
    }

    function onFlashLoan(address, address asset, uint256 amount, uint256 fee, bytes calldata)
        external
        returns (bytes32)
    {
        if (repayLoan) {
            IERC20(asset).transfer(msg.sender, amount + fee);
        }
        return bytes32(SUCCESS);
    }
}


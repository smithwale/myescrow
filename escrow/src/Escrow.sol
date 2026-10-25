// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Escrow {
    enum Status { Created, Funded, ServiceRendered, Completed, Disputed }

    struct EscrowDetail {
        address payable buyer;
        address payable seller;
        uint256 amount;
        Status status;
    }

    address public admin;
    uint256 public platformFeePercent = 2; // Default 2% fee
    mapping(uint256 => EscrowDetail) public escrows;
    uint256 public escrowCount;

    event EscrowCreated(uint256 indexed escrowId, address buyer, address seller, uint256 amount);
    event EscrowFunded(uint256 indexed escrowId);
    event ServiceRendered(uint256 indexed escrowId);
    event EscrowCompleted(uint256 indexed escrowId);
    event EscrowDisputed(uint256 indexed escrowId);
    event EscrowSettled(uint256 indexed escrowId, address winner);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor() {
    admin = msg.sender;
    }

    // Add this new function to update the fee safely
    function setFee(uint256 _newFee) external onlyAdmin {
        require(_newFee <= 10, "Fee cannot exceed 10%"); // Safety cap
        platformFeePercent = _newFee;
    }

    function createEscrow(address payable _seller) external payable returns (uint256) {
        require(msg.value > 0, "Amount should be greater than zero");
        escrowCount++;
        escrows[escrowCount] = EscrowDetail({
            buyer: payable(msg.sender),
            seller: _seller,
            amount: msg.value,
            status: Status.Funded
        });

        emit EscrowCreated(escrowCount, msg.sender, _seller, msg.value);
        return escrowCount;
    }

    function fundEscrow(uint256 _escrowId) external {
        EscrowDetail storage escrow = escrows[_escrowId];
        require(escrow.status == Status.Created, "Escrow is not in Created status");
        require(msg.sender == escrow.buyer, "Only buyer can fund the escrow");

        escrow.status = Status.Funded;
        emit EscrowFunded(_escrowId);
    }

    function renderService(uint256 _escrowId) external {
        EscrowDetail storage escrow = escrows[_escrowId];
        require(escrow.status == Status.Funded, "Escrow is not in Funded status");
        require(msg.sender == escrow.seller, "Only seller can render service");

        escrow.status = Status.ServiceRendered;
        emit ServiceRendered(_escrowId);
    }

    function releaseFunds(uint256 _escrowId) external {
        EscrowDetail storage escrow = escrows[_escrowId];
        require(escrow.status == Status.ServiceRendered, "Escrow is not in ServiceRendered status");
        require(msg.sender == escrow.buyer, "Only buyer can release funds");

       // Calculate fee and the remaining amount for the seller
        uint256 feeAmount = (escrow.amount * platformFeePercent) / 100;
        uint256 sellerAmount = escrow.amount - feeAmount;

        // Transfer funds safely using .call
        (bool feeSuccess, ) = payable(admin).call{value: feeAmount}("");
        require(feeSuccess, "Fee transfer failed");

        (bool sellerSuccess, ) = escrow.seller.call{value: sellerAmount}("");
        require(sellerSuccess, "Seller transfer failed");

        escrow.status = Status.Completed;
        emit EscrowCompleted(_escrowId);
    }

    function openDispute(uint256 _escrowId) external {
        EscrowDetail storage escrow = escrows[_escrowId];
        
        // ✅ FIX: Buyer can dispute if it's Funded OR ServiceRendered. 
        // Seller can only dispute if it's ServiceRendered.
        if (msg.sender == escrow.buyer) {
            require(escrow.status == Status.Funded || escrow.status == Status.ServiceRendered, "Invalid status for buyer dispute");
        } else if (msg.sender == escrow.seller) {
            require(escrow.status == Status.ServiceRendered, "Invalid status for seller dispute");
        } else {
            revert("Only buyer or seller can open dispute");
        }
        
        escrow.status = Status.Disputed;
        emit EscrowDisputed(_escrowId);
}

    function settleDispute(uint256 _escrowId, address payable _winner) external onlyAdmin {
        EscrowDetail storage escrow = escrows[_escrowId];
        require(escrow.status == Status.Disputed, "Escrow is not in Disputed status");

        // Calculate fee and the remaining amount for the winner
            uint256 feeAmount = (escrow.amount * platformFeePercent) / 100;
            uint256 winnerAmount = escrow.amount - feeAmount;

        // Transfer funds safely using .call
            (bool feeSuccess, ) = payable(admin).call{value: feeAmount}("");
            require(feeSuccess, "Fee transfer failed");

            (bool winnerSuccess, ) = _winner.call{value: winnerAmount}("");
            require(winnerSuccess, "Winner transfer failed");

        escrow.status = Status.Completed;
        emit EscrowSettled(_escrowId, _winner);
    }   
}
